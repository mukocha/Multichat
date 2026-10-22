module.exports = function startAutoPolling(context) {
  const { state, io, connectTikTok, disconnectTikTok, fetchTikTokLiveRoomData, connectKick, connectTwitch, fetchYouTubeViewers,
    broadcastViewers, fetchKickChannelData, dispatchAlert, fetchTwitchViewers,
    cleanExpiredAlerts, alertHistory, getConfig, logPollError } = context;

  setInterval(() => {
    const targetTikTok = getConfig().tiktokUsername || state.tiktok.username;
    if (targetTikTok && !state.tiktok.connected && !state.tiktok.connecting) {
      connectTikTok(targetTikTok, true);
    }
  }, 20000);

  setInterval(() => {
    const targetKick = getConfig().kickUsername || state.kick.username;
    if (targetKick && !state.kick.connected && !state.kick.connecting) {
      console.log(`[Kick Auto-Reconnect] Reconectando a Kick @${targetKick}...`);
      connectKick(targetKick);
    }
  }, 15000);

  setInterval(() => {
    const targetTwitch = getConfig().twitchUsername || state.twitch.username;
    if (targetTwitch && !state.twitch.connected && !state.twitch.connecting) {
      console.log(`[Twitch Auto-Reconnect] Reconectando a Twitch @${targetTwitch}...`);
      connectTwitch(targetTwitch);
    }
  }, 15000);

  setInterval(async () => {
    const targetYT = getConfig().youtubeChannel || state.youtube.username;
    if (targetYT) {
      try {
        const { viewers, isLive } = await fetchYouTubeViewers(targetYT);
        state.youtube.viewers = viewers;
        state.youtube.isLive = isLive;
        state.youtube.connected = true;
        broadcastViewers();
      } catch (err) { logPollError('youtube', 'actualizar espectadores', err); }
    }
  }, 35000);

  // Polling para actualizar viewers y seguidores de Kick en vivo cada 15 segundos (evita bloqueo Cloudflare en Render)
  setInterval(async () => {
    if (state.kick.username && state.kick.connected) {
      try {
        const data = await fetchKickChannelData(state.kick.username);
        if (data) {
          // 1. Viewers y estado en directo
          if (data.livestream) {
            state.kick.viewers = data.livestream.viewer_count || 0;
            state.kick.isLive = true;
          } else if (data.livestream === null) {
            state.kick.viewers = 0;
            state.kick.isLive = false;
          }
          broadcastViewers();

          // 2. Detección de seguidores en tiempo real por API de Kick
          if (data.followers_count !== undefined) {
            const currentFollowers = parseInt(data.followers_count, 10);
            if (!isNaN(currentFollowers) && currentFollowers >= 0) {
              if (state.kick.followersCount === null) {
                state.kick.followersCount = currentFollowers;
              } else if (currentFollowers > state.kick.followersCount) {
                const diff = currentFollowers - state.kick.followersCount;
                console.log(`[Kick Polling Watcher] Seguidores subieron de ${state.kick.followersCount} a ${currentFollowers} (+${diff})`);
                state.kick.followersCount = currentFollowers;

                // Solo alertar si el bot de chat no alertó ya en los últimos 12 segundos y diff es razonable
                const elapsed = Date.now() - (state.kick.lastFollowAlertTime || 0);
                if (elapsed > 12000 && diff <= 20) {
                  state.kick.lastFollowAlertTime = Date.now();
                  const alertsToEmit = Math.min(diff, 2);
                  for (let i = 0; i < alertsToEmit; i++) {
                    dispatchAlert({
                      id: `alert-kick-follow-${Date.now()}-${i}`,
                      platform: 'kick',
                      type: 'follow',
                      user: 'Nuevo Seguidor',
                      title: '¡Nuevo Seguidor en Kick!',
                      detail: '¡Alguien te ha comenzado a seguir en Kick! 🟢',
                      timestamp: Date.now()
                    });
                  }
                }
              } else if (currentFollowers < state.kick.followersCount) {
                state.kick.followersCount = currentFollowers;
              }
            }
          }
        }
      } catch (err) { logPollError('kick', 'actualizar espectadores y seguidores', err); }
    }
  }, 15000);

  // Polling para actualizar viewers de TikTok en vivo cada 10 segundos (conteo real en vivo)
  setInterval(async () => {
    if (state.tiktok.connector && state.tiktok.connected) {
      try {
        if (typeof fetchTikTokLiveRoomData === 'function') {
          const roomData = await fetchTikTokLiveRoomData(state.tiktok.connector, state.tiktok.username);
          if (roomData) {
            if (!roomData.isLive && roomData.status === 4) {
              console.log(`[TikTok] Directo finalizado detectado para @${state.tiktok.username}.`);
              if (typeof disconnectTikTok === 'function') disconnectTikTok(true);
              return;
            }
            state.tiktok.viewers = roomData.viewers;
            state.tiktok.isLive = roomData.isLive;
            broadcastViewers();
            return;
          }
        }
        const info = await state.tiktok.connector.fetchRoomInfo();
        if (info && info.data && info.data.user_count !== undefined) {
          state.tiktok.viewers = Number(info.data.user_count) || 0;
          state.tiktok.isLive = info.data.status === 2;
          broadcastViewers();
        }
      } catch (err) { logPollError('tiktok', 'actualizar espectadores', err); }
    }
  }, 10000);

  // Polling para actualizar viewers y seguidores de Twitch en vivo cada 8 segundos vía GraphQL directo
  setInterval(async () => {
    const targetTwitch = state.twitch.username || getConfig().twitchUsername;
    if (targetTwitch) {
      try {
        const { viewers, isLive, followersCount } = await fetchTwitchViewers(targetTwitch);
        state.twitch.viewers = viewers;
        state.twitch.isLive = isLive;
        broadcastViewers();

        // Chequear seguidores de Twitch directamente desde la respuesta JSON de Twitch GraphQL
        if (typeof followersCount === 'number' && followersCount >= 0) {
          if (state.twitch.followersCount === null) {
            state.twitch.followersCount = followersCount;
          } else if (followersCount > state.twitch.followersCount) {
            const diff = followersCount - state.twitch.followersCount;
            console.log(`[Twitch Polling Watcher] Seguidores subieron de ${state.twitch.followersCount} a ${followersCount} (+${diff})`);
            state.twitch.followersCount = followersCount;
            const elapsed = Date.now() - (state.twitch.lastFollowAlertTime || 0);
            if (elapsed > 10000 && diff <= 20) {
              state.twitch.lastFollowAlertTime = Date.now();
              const alertsToEmit = Math.min(diff, 2);
              for (let i = 0; i < alertsToEmit; i++) {
                dispatchAlert({
                  id: `alert-twitch-follow-${Date.now()}-${i}`,
                  platform: 'twitch',
                  type: 'follow',
                  user: 'Nuevo Seguidor',
                  title: '¡Nuevo Seguidor en Twitch!',
                  detail: '¡Alguien te ha comenzado a seguir en Twitch! 🟣',
                  timestamp: Date.now()
                });
              }
            }
          } else if (followersCount < state.twitch.followersCount) {
            state.twitch.followersCount = followersCount;
          }
        }
      } catch (err) { logPollError('twitch', 'actualizar espectadores y seguidores', err); }
    }
  }, 8000);

  // Polling para actualizar viewers de YouTube en vivo cada 15 segundos
  setInterval(async () => {
    if (state.youtube.username && state.youtube.connected) {
      try {
        const { viewers, isLive } = await fetchYouTubeViewers(state.youtube.username);
        state.youtube.viewers = viewers;
        state.youtube.isLive = isLive;
        broadcastViewers();
      } catch (err) { logPollError('youtube', 'actualizar espectadores en directo', err); }
    }
  }, 15000);

  // Limpieza periódica de notificaciones que superen los 10 minutos (600,000 ms)
  setInterval(() => {
    const beforeCount = alertHistory.length;
    cleanExpiredAlerts();
    if (alertHistory.length !== beforeCount) {
      io.emit('alert:history', alertHistory);
    }
  }, 15000);

  // Keep-Alive automático en Render para evitar que el contenedor entre en suspensión durante el stream
  const renderUrl = process.env.RENDER_EXTERNAL_URL;
  if (renderUrl) {
    setInterval(() => {
      fetch(`${renderUrl.replace(/\/$/, '')}/api/ping`).catch(() => {});
    }, 4 * 60 * 1000);
  }

};
