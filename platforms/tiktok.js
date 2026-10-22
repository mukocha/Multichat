module.exports = function createPlatform(context) {
  const { state, io, broadcastStatus, broadcastViewers, saveConfig, dispatchAlert, getDeterministicColor, execFile, TikTokLiveConnection, RouteConfig, tmi, getConfig, logPollError } = context;

  // Caché global de IDs y huellas de mensajes de TikTok para evitar repetir mensajes del buffer al conectar/reconectar
  const seenTikTokMsgIds = new Set();
  const recentTikTokFingerprints = new Map();

  function rememberTikTokMsgId(id) {
    if (!id) return;
    seenTikTokMsgIds.add(String(id));
    if (seenTikTokMsgIds.size > 2500) {
      const first = seenTikTokMsgIds.values().next().value;
      if (first !== undefined) seenTikTokMsgIds.delete(first);
    }
  }

  function isOldOrDuplicateTikTokEvent(data, connectedAt, fingerprintKey = '') {
    const msgId = data?.common?.msgId || data?.msgId;
    if (msgId && seenTikTokMsgIds.has(String(msgId))) {
      return true;
    }

    const rawCreateTime = Number(data?.common?.createTime || data?.createTime || 0);
    if (rawCreateTime > 0) {
      const createTimeMs = rawCreateTime < 1e11 ? rawCreateTime * 1000 : rawCreateTime;
      // Si el mensaje fue creado antes de que iniciara esta conexión (con 5s de margen), es del historial inicial de la sala
      if (createTimeMs < connectedAt - 5000) {
        if (msgId) rememberTikTokMsgId(msgId);
        return true;
      }
    }

    const now = Date.now();
    if (fingerprintKey) {
      const lastSeen = recentTikTokFingerprints.get(fingerprintKey);
      if (lastSeen && (now - lastSeen) < 30000) {
        if (msgId) rememberTikTokMsgId(msgId);
        return true;
      }
      recentTikTokFingerprints.set(fingerprintKey, now);
      if (recentTikTokFingerprints.size > 1000) {
        for (const [k, ts] of recentTikTokFingerprints.entries()) {
          if (now - ts > 60000) recentTikTokFingerprints.delete(k);
        }
      }
    }

    if (msgId) rememberTikTokMsgId(msgId);
    return false;
  }

  // Consulta directa al endpoint oficial api-live/user/room/ de TikTok (devuelve status 2=LIVE, 4=OFFLINE y userCount real)
  async function fetchTikTokLiveRoomData(tiktokConnector, username) {
    try {
      const cleanUser = (username || tiktokConnector?.uniqueId || state.tiktok.username || '').trim().replace(/^@/, '');
      if (!cleanUser || !tiktokConnector?.webClient) return null;
      const roomData = await tiktokConnector.webClient.getJsonObjectFromTikTokApi('api-live/user/room/', {
        ...tiktokConnector.webClient.clientParams,
        uniqueId: cleanUser,
        sourceType: '54'
      });
      const liveRoom = roomData?.data?.liveRoom;
      if (liveRoom && liveRoom.status !== undefined) {
        const status = Number(liveRoom.status);
        const viewers = Number(liveRoom.liveRoomStats?.userCount ?? liveRoom.user_count ?? 0) || 0;
        return {
          isLive: status === 2,
          status,
          viewers,
          roomId: roomData?.data?.user?.roomId || liveRoom.roomId || ''
        };
      }
    } catch (_) {}
    return null;
  }

  // CONECTOR DE TIKTOK (tiktok-live-connector con Auto-Detección de LIVE)
  // -------------------------------------------------------------
  async function connectTikTok(username, isAutoPoll = false) {
    if (!username) return;
    username = username.trim().replace(/^@/, '');

    if (state.tiktok.connector) {
      const oldConn = state.tiktok.connector;
      state.tiktok.connector = null;
      try {
        oldConn.removeAllListeners();
        oldConn.disconnect();
      } catch (_) {}
    }

    state.tiktok.username = username;
    state.tiktok.connecting = true;
    if (!isAutoPoll) {
      state.tiktok.error = null;
      broadcastStatus();
    }

    try {
      if (!isAutoPoll) {
        console.log(`[TikTok] Verificando y conectando al live de '@${username}'...`);
      }

      const tiktokConnector = new TikTokLiveConnection(username, {
        processInitialData: false,
        fetchRoomInfoOnConnect: false,
        enableExtendedGiftInfo: false,
        enableWebsocketUpgrade: true,
        requestPollingIntervalMs: 2000
      });

      // Verificar primero si el canal realmente está EN VIVO (status === 2) para no conectarse a salas finalizadas
      const roomCheck = await fetchTikTokLiveRoomData(tiktokConnector, username);
      if (roomCheck) {
        if (!roomCheck.isLive) {
          throw Object.assign(new Error("The requested user isn't online :("), { name: 'UserOfflineError' });
        }
      } else {
        const isLiveFallback = await tiktokConnector.fetchIsLive().catch(() => false);
        if (!isLiveFallback) {
          throw Object.assign(new Error("The requested user isn't online :("), { name: 'UserOfflineError' });
        }
      }

      // Si mientras verificábamos cambió el usuario, abortar
      if (state.tiktok.username !== username) {
        state.tiktok.connecting = false;
        return;
      }

      state.tiktok.connector = tiktokConnector;
      let connectedAt = Date.now();

      // IMPORTANTE: Escuchar 'error' para evitar que EventEmitter tumbe el servidor Node.js ante micro-cortes de TikTok
      tiktokConnector.on('error', (err) => {
        console.warn(`[TikTok Stream Warning] (@${username}):`, err?.info || err?.message || err);
      });

      tiktokConnector.on('connected', () => {
        if (state.tiktok.connector !== tiktokConnector) return;
        connectedAt = Date.now();
        console.log(`[TikTok] 🔴 ¡EN VIVO! Conectado exitosamente al directo de @${username}`);
        state.tiktok.connected = true;
        state.tiktok.connecting = false;
        state.tiktok.isLive = true;
        state.tiktok.error = null;
        if (roomCheck && roomCheck.viewers > 0) {
          state.tiktok.viewers = roomCheck.viewers;
        }
        fetchTikTokLiveRoomData(tiktokConnector, username).then(info => {
          if (state.tiktok.connector !== tiktokConnector || !info) return;
          state.tiktok.viewers = info.viewers;
          state.tiktok.isLive = info.isLive;
          broadcastViewers();
        }).catch(() => {});
        broadcastStatus();
      });

      // Actualización rápida de espectadores en vivo en TikTok cuando entran/salen usuarios
      let debounceRoomUser = null;
      tiktokConnector.on('roomUser', (data) => {
        if (state.tiktok.connector !== tiktokConnector) return;
        if (data && data.viewerCount !== undefined) {
          state.tiktok.viewers = Number(data.viewerCount) || 0;
          broadcastViewers();
        }
        clearTimeout(debounceRoomUser);
        debounceRoomUser = setTimeout(async () => {
          if (state.tiktok.connector === tiktokConnector && state.tiktok.connected) {
            try {
              const info = await fetchTikTokLiveRoomData(tiktokConnector, username);
              if (info) {
                state.tiktok.viewers = info.viewers;
                state.tiktok.isLive = info.isLive;
                broadcastViewers();
              }
            } catch (_) {}
          }
        }, 2500);
      });

      tiktokConnector.on('disconnected', () => {
        if (state.tiktok.connector !== tiktokConnector) return;
        console.log(`[TikTok] Desconectado de @${username}. Reintentando en breve...`);
        state.tiktok.connected = false;
        state.tiktok.connecting = false;
        state.tiktok.isLive = false;
        state.tiktok.viewers = 0;
        broadcastStatus();
        // Si la cuenta sigue vinculada, intentar reconexión en 8s verificando primero si sigue en vivo
        setTimeout(() => {
          const target = getConfig().tiktokUsername || state.tiktok.username;
          if (target && !state.tiktok.connected && !state.tiktok.connecting) {
            connectTikTok(target, true);
          }
        }, 8000);
      });

      tiktokConnector.on('streamEnd', () => {
        if (state.tiktok.connector !== tiktokConnector) return;
        console.log(`[TikTok] El directo de @${username} ha terminado.`);
        state.tiktok.connected = false;
        state.tiktok.connecting = false;
        state.tiktok.viewers = 0;
        state.tiktok.isLive = false;
        state.tiktok.error = null;
        broadcastStatus();
      });

      // Chat en vivo de TikTok (con filtro anti-repetición de historial inicial)
      tiktokConnector.on('chat', (data) => {
        if (state.tiktok.connector !== tiktokConnector) return;
        // Ignorar el volcado inicial del buffer de la sala durante los primeros 1.5s tras switchRooms si no trae createTime reciente
        const user = data.user || {};
        const uniqueId = user.uniqueId || user.displayId || data.uniqueId || 'tiktok_user';
        const nickname = user.nickname || data.nickname || uniqueId;
        const message = (data.content || data.comment || '').trim();
        if (!message) return;

        const fpKey = `chat:${uniqueId.toLowerCase()}:${message.toLowerCase()}`;
        if (isOldOrDuplicateTikTokEvent(data, connectedAt, fpKey)) {
          return;
        }

        const avatar = user.profilePicture?.urls?.[0] || data.profilePictureUrl || '';
        const userColor = getDeterministicColor(nickname || uniqueId);
        const msgId = data.common?.msgId || data.msgId || `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

        const chatMsg = {
          id: `tiktok-${msgId}`,
          platform: 'tiktok',
          user: uniqueId,
          nickname: nickname,
          message: message,
          color: userColor,
          avatar: avatar,
          badges: (user.badgeList || data.userBadges || []).map(b => b.name || b.type).filter(Boolean),
          timestamp: Date.now()
        };

        console.log(`[TikTok Chat] ${chatMsg.nickname}: ${chatMsg.message}`);
        io.emit('chat:message', chatMsg);
      });

      // Regalos (Gifts) de TikTok
      tiktokConnector.on('gift', (data) => {
        if (state.tiktok.connector !== tiktokConnector) return;
        const user = data.user || {};
        const username = user.nickname || user.uniqueId || data.nickname || data.uniqueId || 'Alguien';
        const giftName = data.giftDetails?.giftName || data.giftName || (data.gift && data.gift.name) || 'Regalo';
        const repeatCount = Number(data.repeatCount || 1);
        const fpKey = `gift:${username.toLowerCase()}:${giftName}:${repeatCount}:${data.groupId || ''}`;
        if (isOldOrDuplicateTikTokEvent(data, connectedAt, fpKey)) return;

        const diamondCount = Number(data.diamondCount || data.giftDetails?.diamondCount || 1);
        const totalDiamonds = diamondCount * repeatCount;
        const icon = data.giftPictureUrl || data.giftDetails?.giftImage?.url?.[0] || '';

        dispatchAlert({
          id: `alert-tiktok-gift-${Date.now()}-${data.giftId || Math.random()}`,
          platform: 'tiktok',
          type: 'gift',
          user: username,
          title: '¡Regalo en TikTok Live!',
          detail: `envió ${giftName} x${repeatCount} (${totalDiamonds} 🪙)`,
          gift: {
            name: giftName,
            count: repeatCount,
            coins: totalDiamonds,
            icon: icon
          },
          timestamp: Date.now()
        });
      });

      // Nuevos seguidores en TikTok
      tiktokConnector.on('follow', (data) => {
        if (state.tiktok.connector !== tiktokConnector) return;
        const user = data.user || {};
        const username = user.nickname || user.uniqueId || data.nickname || data.uniqueId || 'Nuevo Seguidor';
        if (isOldOrDuplicateTikTokEvent(data, connectedAt, `follow:${username.toLowerCase()}`)) return;

        dispatchAlert({
          id: `alert-tiktok-follow-${Date.now()}`,
          platform: 'tiktok',
          type: 'follow',
          user: username,
          title: '¡Nuevo Seguidor en TikTok!',
          detail: `${username} te ha seguido 💖`,
          timestamp: Date.now()
        });
      });

      // Compartir el live en TikTok
      tiktokConnector.on('share', (data) => {
        if (state.tiktok.connector !== tiktokConnector) return;
        const user = data.user || {};
        const username = user.nickname || user.uniqueId || data.nickname || data.uniqueId || 'Alguien';
        if (isOldOrDuplicateTikTokEvent(data, connectedAt, `share:${username.toLowerCase()}`)) return;

        dispatchAlert({
          id: `alert-tiktok-share-${Date.now()}`,
          platform: 'tiktok',
          type: 'share',
          user: username,
          title: '¡Compartieron el Live!',
          detail: `${username} compartió la transmisión 🚀`,
          timestamp: Date.now()
        });
      });

      await tiktokConnector.connect(roomCheck?.roomId || undefined);

    } catch (err) {
      if (state.tiktok.connector && state.tiktok.connected) return;
      state.tiktok.connecting = false;
      state.tiktok.connected = false;
      state.tiktok.isLive = false;
      state.tiktok.viewers = 0;

      const isOffline = (err.name === 'UserOfflineError') ||
        (err.message && (err.message.includes("isn't online") || err.message.includes('offline') || err.message.includes('404')));

      if (isOffline) {
        state.tiktok.error = null;
        if (!isAutoPoll) {
          console.log(`[TikTok] @${username} no está en directo en este momento. Se conectará automáticamente al iniciar directo.`);
        }
      } else {
        console.error('[TikTok] Error de conexión:', err.message || err);
        state.tiktok.error = 'Desconectado';
      }
      if (!isAutoPoll) {
        broadcastStatus();
      }
    }
  }

  function disconnectTikTok(shouldBroadcast = true) {
    if (state.tiktok.connector) {
      const oldConn = state.tiktok.connector;
      state.tiktok.connector = null;
      try {
        oldConn.removeAllListeners();
        oldConn.disconnect();
      } catch (_) {}
    }
    state.tiktok.connected = false;
    state.tiktok.connecting = false;
    state.tiktok.viewers = 0;
    state.tiktok.isLive = false;
    state.tiktok.error = null;
    if (shouldBroadcast) broadcastStatus();
  }

  return { connectTikTok, disconnectTikTok, fetchTikTokLiveRoomData };
};
