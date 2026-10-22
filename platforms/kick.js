module.exports = function createPlatform(context) {
  const { state, io, broadcastStatus, broadcastViewers, saveConfig, dispatchAlert, getDeterministicColor, execFile, TikTokLiveConnection, RouteConfig, tmi, getConfig, logPollError } = context;
const kickChannelCache = {};
// OBTENER DATOS DE CANAL KICK (Bypass Cloudflare + Caché de Respaldo)
// -------------------------------------------------------------
function fetchKickChannelData(username) {
  const cleanUser = username.trim().toLowerCase();
  const targetUrl = `https://kick.com/api/v2/channels/${encodeURIComponent(cleanUser)}`;
  const curlCmd = process.platform === 'win32' ? 'curl.exe' : 'curl';

  return new Promise((resolve, reject) => {
    execFile(curlCmd, [
      '-s', '-L', '--max-time', '8',
      targetUrl,
      '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      '-H', 'Accept: application/json'
    ], (err, stdout) => {
      if (!err && stdout) {
        try {
          const data = JSON.parse(stdout);
          if (data && (data.id || data.chatroom)) {
            return resolve(data);
          }
        } catch (_) {}
      }

      fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        }
      })
      .then(async res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (data && (data.id || data.chatroom)) return resolve(data);
        throw new Error('Respuesta incompleta de Kick');
      })
      .catch(async (primaryErr) => {
        // Fallback proxy público por si Cloudflare bloquea temporalmente la IP de Render
        try {
          const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
          const pRes = await fetch(proxyUrl);
          if (pRes.ok) {
            const pData = await pRes.json();
            if (pData && (pData.id || pData.chatroom)) {
              return resolve(pData);
            }
          }
        } catch (_) {}
        reject(primaryErr);
      });
    });
  });
}

// -------------------------------------------------------------
// CONECTOR DE KICK (Pusher WebSocket)
// -------------------------------------------------------------
const KICK_PUSHER_KEY = '32cbd69e4b950bf97679';
const KICK_CLUSTER = 'us2';

async function connectKick(username) {
  if (!username) return;
  username = username.trim().toLowerCase();

  disconnectKick(false);

  state.kick.username = username;
  state.kick.connecting = true;
  state.kick.error = null;
  broadcastStatus();

  try {
    console.log(`[Kick] Obteniendo datos para canal '${username}'...`);
    let data = null;
    try {
      data = await fetchKickChannelData(username);
    } catch (fetchErr) {
      const cached = kickChannelCache[username] || (getConfig().kickCache && getConfig().kickCache[username]);
      if (cached && cached.chatroomId && cached.channelId) {
        console.log(`[Kick] Usando IDs en caché para '${username}' (Chatroom: ${cached.chatroomId}, Channel: ${cached.channelId})`);
        data = { id: cached.channelId, chatroom: { id: cached.chatroomId } };
      } else {
        throw fetchErr;
      }
    }

    // Si mientras esperábamos la respuesta HTTP el usuario cambió o desconectó el canal, abortar
    if (state.kick.username !== username) return;

    const chatroomId = data.chatroom?.id || data.id;
    const channelId = data.id;

    if (!chatroomId || !channelId) {
      throw new Error('No se pudo encontrar el ID de chatroom para este canal');
    }

    state.kick.channelId = channelId;
    state.kick.chatroomId = chatroomId;

    // Guardar en caché en memoria y en config persistente
    kickChannelCache[username] = { channelId, chatroomId };
    if (!getConfig().kickCache) getConfig().kickCache = {};
    if (!getConfig().kickCache[username] || getConfig().kickCache[username].chatroomId !== chatroomId) {
      getConfig().kickCache[username] = { channelId, chatroomId };
      saveConfig(getConfig());
    }

    if (data.followers_count !== undefined) {
      const fCount = parseInt(data.followers_count, 10);
      if (!isNaN(fCount)) {
        state.kick.followersCount = fCount;
        console.log(`[Kick] Conteo inicial de seguidores para @${username}: ${fCount}`);
      }
    }

    if (data.livestream) {
      state.kick.viewers = data.livestream.viewer_count || 0;
      state.kick.isLive = true;
    } else if (data.livestream === null) {
      state.kick.viewers = 0;
      state.kick.isLive = false;
    }
    broadcastViewers();

    console.log(`[Kick] Conectando a Pusher para '${username}' (Chatroom: ${chatroomId}, Channel: ${channelId}, Viewers: ${state.kick.viewers})...`);

    const wsUrl = `wss://ws-${KICK_CLUSTER}.pusher.com/app/${KICK_PUSHER_KEY}?protocol=7&client=js&version=8.4.0&flash=false`;
    const ws = new WebSocket(wsUrl);
    state.kick.ws = ws;

    ws.onopen = () => {
      if (state.kick.ws !== ws) return;
      console.log(`[Kick] ✅ WebSocket conectado exitosamente a Pusher.`);

      ws.send(JSON.stringify({
        event: 'pusher:subscribe',
        data: { auth: '', channel: `chatrooms.${chatroomId}.v2` }
      }));

      ws.send(JSON.stringify({
        event: 'pusher:subscribe',
        data: { auth: '', channel: `channel.${channelId}` }
      }));

      if (state.kick.pingInterval) clearInterval(state.kick.pingInterval);
      state.kick.pingInterval = setInterval(() => {
        if (state.kick.ws === ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ event: 'pusher:ping', data: {} }));
        }
      }, 20000);

      state.kick.connected = true;
      state.kick.connecting = false;
      state.kick.error = null;
      broadcastStatus();
    };

    ws.onmessage = (event) => {
      if (state.kick.ws !== ws) return;
      try {
        const payload = JSON.parse(event.data);
        handleKickEvent(payload);
      } catch (err) {
        console.error('[Kick] Error parseando mensaje WS:', err);
      }
    };

    ws.onerror = (err) => {
      if (state.kick.ws !== ws) return;
      console.error('[Kick] Error en WebSocket:', err.message || err);
    };

    ws.onclose = () => {
      // Ignorar evento onclose si pertenece a un WebSocket anterior ya reemplazado
      if (state.kick.ws !== ws) return;
      console.log('[Kick] WebSocket cerrado. Reintentando reconexión en segundo plano...');
      if (state.kick.pingInterval) {
        clearInterval(state.kick.pingInterval);
        state.kick.pingInterval = null;
      }
      state.kick.ws = null;
      state.kick.connected = false;
      state.kick.connecting = false;
      broadcastStatus();
    };

  } catch (err) {
    console.error('[Kick] Error al conectar:', err.message);
    state.kick.connecting = false;
    state.kick.connected = false;
    state.kick.error = err.message;
    broadcastStatus();
  }
}

function disconnectKick(shouldBroadcast = true) {
  if (state.kick.pingInterval) {
    clearInterval(state.kick.pingInterval);
    state.kick.pingInterval = null;
  }
  if (state.kick.ws) {
    const oldWs = state.kick.ws;
    state.kick.ws = null;
    try {
      oldWs.onopen = null;
      oldWs.onmessage = null;
      oldWs.onerror = null;
      oldWs.onclose = null;
      oldWs.close();
    } catch (_) {}
  }
  state.kick.connected = false;
  state.kick.connecting = false;
  state.kick.viewers = 0;
  state.kick.followersCount = null;
  state.kick.lastFollowAlertTime = 0;
  state.kick.isLive = false;
  state.kick.error = null;
  if (shouldBroadcast) broadcastStatus();
}

function handleKickEvent(payload) {
  const { event, data } = payload;
  if (!event || event.startsWith('pusher:')) return;

  let parsedData = {};
  if (typeof data === 'string') {
    try {
      parsedData = JSON.parse(data);
    } catch (_) {
      parsedData = { raw: data };
    }
  } else if (data) {
    parsedData = data;
  }

  // 1. Mensaje de Chat en Kick
  if (event === 'App\\Events\\ChatMessageEvent') {
    const sender = parsedData.sender || {};
    const identity = sender.identity || {};
    const chatMsg = {
      id: parsedData.id || `kick-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      platform: 'kick',
      user: sender.username || 'Anónimo',
      nickname: sender.username || 'Anónimo',
      message: parsedData.content || '',
      color: identity.color || getDeterministicColor(sender.username || 'kick_user'),
      avatar: sender.profile_thumb || '',
      badges: (identity.badges || []).map(b => b.type || b.text),
      timestamp: Date.now()
    };

    console.log(`[Kick Chat] ${chatMsg.user}: ${chatMsg.message}`);
    io.emit('chat:message', chatMsg);

    // Detección automática de seguidor anunciado en chat por bots (KickBot, BotRix, System, etc.)
    const senderLower = (chatMsg.user || '').toLowerCase();
    const msgText = (chatMsg.message || '').trim();
    const followMatch = msgText.match(/(?:thanks\s+for\s+(?:the\s+)?follow(?:ing)?|gracias\s+por\s+seguir(?:nos)?|now\s+following)\s+@?([a-zA-Z0-9_\-\.]+)/i);
    const isBot = ['kickbot', 'botrix', 'system'].includes(senderLower) || senderLower.includes('bot') || msgText.toLowerCase().startsWith('thanks for the follow');

    if (followMatch && isBot) {
      const followerName = followMatch[1];
      console.log(`[Kick Follow Bot Detect] ¡Nuevo seguidor anunciado por bot en el chat: @${followerName}!`);
      state.kick.lastFollowAlertTime = Date.now();
      if (typeof state.kick.followersCount === 'number') {
        state.kick.followersCount++;
      }
      dispatchAlert({
        id: `alert-kick-follow-${Date.now()}`,
        platform: 'kick',
        type: 'follow',
        user: followerName,
        title: '¡Nuevo Seguidor en Kick!',
        detail: `@${followerName} ahora te sigue en Kick 🟢`,
        timestamp: Date.now()
      });
    }
  }

  // 2. Nuevo seguidor en Kick (si Kick lo emite vía WebSocket Pusher)
  else if (event && (event.includes('FollowersUpdated') || event.toLowerCase().includes('follower'))) {
    console.log('[Kick WS] Evento follower recibido:', event, JSON.stringify(parsedData));
    if (parsedData.followed === false) {
      return; // Dejó de seguir
    }
    const username = parsedData.username || parsedData.follower?.username || 'Nuevo Seguidor';
    state.kick.lastFollowAlertTime = Date.now();
    if (parsedData.followersCount !== undefined) {
      const parsedCount = parseInt(parsedData.followersCount, 10);
      if (!isNaN(parsedCount)) state.kick.followersCount = parsedCount;
    }
    dispatchAlert({
      id: `alert-kick-follow-${Date.now()}`,
      platform: 'kick',
      type: 'follow',
      user: username,
      title: '¡Nuevo Seguidor en Kick!',
      detail: `${username} ahora te sigue en Kick 🟢`,
      timestamp: Date.now()
    });
  }

  // 3. Suscripción en Kick
  else if (event === 'App\\Events\\SubscriptionEvent') {
    const username = parsedData.username || 'Suscriptor';
    const months = parsedData.months || 1;
    dispatchAlert({
      id: `alert-kick-sub-${Date.now()}`,
      platform: 'kick',
      type: 'sub',
      user: username,
      title: '¡Nueva Suscripción en Kick!',
      detail: `${username} se ha suscrito (${months} ${months === 1 ? 'mes' : 'meses'}) ⭐`,
      timestamp: Date.now()
    });
  }

  // 4. Suscripciones regaladas en Kick
  else if (event === 'App\\Events\\GiftedSubscriptionsEvent') {
    const gifter = parsedData.gifter_username || 'Alguien';
    const count = parsedData.gifted_usernames ? parsedData.gifted_usernames.length : 1;
    dispatchAlert({
      id: `alert-kick-giftsub-${Date.now()}`,
      platform: 'kick',
      type: 'sub',
      user: gifter,
      title: '¡Suscripciones Regaladas en Kick!',
      detail: `${gifter} regaló ${count} ${count === 1 ? 'suscripción' : 'suscripciones'} 🎁`,
      timestamp: Date.now()
    });
  }

  // 5. Host en Kick
  else if (event === 'App\\Events\\StreamHostEvent') {
    const hoster = parsedData.hoster_username || parsedData.username || parsedData.channel?.user?.username || 'Alguien';
    const viewers = parsedData.number_viewers || parsedData.viewers || 0;
    const detail = viewers > 0 
      ? `te está hosteando con ${viewers} espectadores 📡`
      : `te está hosteando en Kick 📡`;
    dispatchAlert({
      id: `alert-kick-host-${Date.now()}`,
      platform: 'kick',
      type: 'host',
      user: hoster,
      title: '¡Host en Kick!',
      detail: detail,
      timestamp: Date.now()
    });
  }

  // 6. Raid en Kick
  else if (event.includes('Raid') || event === 'App\\Events\\StreamRaidEvent') {
    const raider = parsedData.raider_username || parsedData.username || parsedData.channel?.user?.username || 'Alguien';
    const viewers = parsedData.number_viewers || parsedData.viewers || 0;
    const detail = viewers > 0 
      ? `llegó con una raid de ${viewers} espectadores 🚀`
      : `llegó con una raid en Kick 🚀`;
    dispatchAlert({
      id: `alert-kick-raid-${Date.now()}`,
      platform: 'kick',
      type: 'raid',
      user: raider,
      title: '¡Raid en Kick!',
      detail: detail,
      timestamp: Date.now()
    });
  }
}

// -------------------------------------------------------------

    return { fetchKickChannelData, connectKick, disconnectKick, handleKickEvent };
};
