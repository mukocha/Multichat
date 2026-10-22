module.exports = function createPlatform(context) {
  const { state, io, broadcastStatus, broadcastViewers, saveConfig, dispatchAlert, getDeterministicColor, execFile, TikTokLiveConnection, RouteConfig, tmi, getConfig, logPollError } = context;
// CONECTOR DE TWITCH (tmi.js WebSocket IRC + GQL Viewers & Followers)
// -------------------------------------------------------------
async function fetchTwitchViewers(channel) {
  if (!channel) return { viewers: 0, isLive: false, followersCount: null };
  const cleanChannel = channel.toLowerCase().trim();
  try {
    const res = await fetch('https://gql.twitch.tv/gql', {
      method: 'POST',
      headers: {
        'Client-ID': 'kimne78kx3ncx6brgo4mv6wki5h1ko',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: `query { user(login: "${cleanChannel}") { id login followers { totalCount } stream { id viewersCount type } } }`
      })
    });
    if (res.ok) {
      const data = await res.json();
      const user = data?.data?.user;
      if (user) {
        const followersCount = typeof user.followers?.totalCount === 'number' ? user.followers.totalCount : null;
        const stream = user.stream;
        if (stream && stream.viewersCount !== undefined) {
          return {
            viewers: Number(stream.viewersCount) || 0,
            isLive: true,
            followersCount
          };
        }
        return {
          viewers: 0,
          isLive: false,
          followersCount
        };
      }
    }
  } catch (err) { logPollError('twitch', 'consulta de estado en vivo', err); }

  // Fallback seguro a DecAPI solo si devuelve un número entero limpio (nunca HTML)
  try {
    const decRes = await fetch(`https://decapi.me/twitch/viewercount/${cleanChannel}`);
    if (decRes.ok) {
      const text = (await decRes.text()).trim();
      if (/^[0-9,]+$/.test(text)) {
        const v = parseInt(text.replace(/,/g, ''), 10);
        if (!isNaN(v)) return { viewers: v, isLive: true, followersCount: null };
      }
    }
  } catch (err) { logPollError('twitch', 'consulta alternativa de espectadores', err); }

  return { viewers: 0, isLive: false, followersCount: null };
}

function connectTwitch(channel) {
  if (!channel) return;
  channel = channel.trim().toLowerCase().replace(/^#/, '').replace(/^https?:\/\/.*twitch\.tv\//, '');
  disconnectTwitch(false);

  state.twitch.username = channel;
  state.twitch.connecting = true;
  state.twitch.error = null;
  broadcastStatus();

  try {
    console.log(`[Twitch] Conectando a chat de '${channel}' vía IRC/tmi.js...`);
    const client = new tmi.Client({
      options: { debug: false },
      connection: { reconnect: true, secure: true },
      channels: [channel]
    });

    state.twitch.client = client;

    client.on('connected', (address, port) => {
      if (state.twitch.client !== client) return;
      console.log(`[Twitch] ✅ Conectado exitosamente al chat de #${channel} (${address}:${port})`);
      state.twitch.connected = true;
      state.twitch.connecting = false;
      state.twitch.error = null;
      broadcastStatus();

      // Consultar viewers y conteo inicial de seguidores inmediatamente al conectar
      fetchTwitchViewers(channel).then(({ viewers, isLive, followersCount }) => {
        if (state.twitch.client !== client) return;
        state.twitch.viewers = viewers;
        state.twitch.isLive = isLive;
        if (typeof followersCount === 'number') {
          state.twitch.followersCount = followersCount;
          console.log(`[Twitch] Conteo inicial de seguidores para #${channel}: ${followersCount}`);
        }
        broadcastStatus();
      });
    });

    client.on('message', (targetChannel, tags, message, self) => {
      if (self || state.twitch.client !== client) return;

      const user = tags['display-name'] || tags.username || 'twitch_user';
      const userColor = tags.color || getDeterministicColor(user);
      const badges = [];
      if (tags.badges) {
        if (tags.badges.broadcaster) badges.push('broadcaster');
        if (tags.badges.moderator) badges.push('moderator');
        if (tags.badges.subscriber) badges.push('subscriber');
        if (tags.badges.vip) badges.push('vip');
      }

      const chatMsg = {
        id: `twitch-${tags.id || Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        platform: 'twitch',
        user: user,
        nickname: user,
        message: message,
        color: userColor,
        avatar: '',
        badges: badges,
        timestamp: Date.now()
      };

      console.log(`[Twitch Chat] ${chatMsg.nickname}: ${chatMsg.message}`);
      io.emit('chat:message', chatMsg);

      // Detección automática si un bot (StreamElements, Nightbot, Streamlabs, BotRix, etc.) anuncia un nuevo seguidor
      const senderLower = (user || '').toLowerCase();
      const msgText = (message || '').trim();
      const followMatch = msgText.match(/(?:thanks?\s+for\s+(?:the\s+)?follow(?:ing)?|gracias\s+por\s+seguir(?:nos)?|now\s+following)\s+@?([a-zA-Z0-9_\-\.]+)/i);
      const isBot = ['streamelements', 'nightbot', 'streamlabs', 'botrix', 'moobot', 'wizebot', 'fossabot'].includes(senderLower) || senderLower.includes('bot');

      if (followMatch && isBot) {
        const followerName = followMatch[1].replace(/[!,.:]+$/, '');
        console.log(`[Twitch Follow Bot Detect] ¡Nuevo seguidor anunciado en chat: @${followerName}!`);
        state.twitch.lastFollowAlertTime = Date.now();
        if (typeof state.twitch.followersCount === 'number') {
          state.twitch.followersCount++;
        }
        dispatchAlert({
          id: `alert-twitch-follow-${Date.now()}`,
          platform: 'twitch',
          type: 'follow',
          user: followerName,
          title: '¡Nuevo Seguidor en Twitch!',
          detail: `@${followerName} ahora te sigue en Twitch 🟣`,
          timestamp: Date.now()
        });
      }
    });

    // Suscripciones en Twitch
    client.on('subscription', (channel, username, method, message, userstate) => {
      if (state.twitch.client !== client) return;
      dispatchAlert({
        id: `alert-twitch-sub-${Date.now()}`,
        platform: 'twitch',
        type: 'subscription',
        user: username,
        title: '¡Nueva Suscripción en Twitch!',
        detail: `${username} se ha suscrito al canal 🟣`,
        timestamp: Date.now()
      });
    });

    client.on('resub', (channel, username, months, message, userstate, methods) => {
      if (state.twitch.client !== client) return;
      dispatchAlert({
        id: `alert-twitch-resub-${Date.now()}`,
        platform: 'twitch',
        type: 'subscription',
        user: username,
        title: '¡Re-Suscripción en Twitch!',
        detail: `${username} se ha re-suscrito (${months} meses) 🟣`,
        timestamp: Date.now()
      });
    });

    // Cheers / Bits en Twitch
    client.on('cheer', (channel, userstate, message) => {
      if (state.twitch.client !== client) return;
      const bits = userstate.bits || '100';
      const username = userstate['display-name'] || userstate.username || 'Alguien';
      dispatchAlert({
        id: `alert-twitch-cheer-${Date.now()}`,
        platform: 'twitch',
        type: 'cheer',
        user: username,
        title: '¡Bits en Twitch!',
        detail: `${username} envió ${bits} bits 💎`,
        timestamp: Date.now()
      });
    });

    // Raids en Twitch
    client.on('raided', (channel, username, viewers) => {
      if (state.twitch.client !== client) return;
      dispatchAlert({
        id: `alert-twitch-raid-${Date.now()}`,
        platform: 'twitch',
        type: 'raid',
        user: username,
        title: '¡Raid en Twitch!',
        detail: `${username} llega con ${viewers || 0} espectadores 🚀`,
        timestamp: Date.now()
      });
    });

    // Hosts en Twitch
    client.on('hosted', (channel, username, viewers, autohost) => {
      if (autohost || state.twitch.client !== client) return;
      dispatchAlert({
        id: `alert-twitch-host-${Date.now()}`,
        platform: 'twitch',
        type: 'host',
        user: username,
        title: '¡Host en Twitch!',
        detail: `${username} te está hosteando con ${viewers || 0} espectadores 📡`,
        timestamp: Date.now()
      });
    });

    client.on('disconnected', (reason) => {
      if (state.twitch.client !== client) return;
      console.log(`[Twitch] Desconectado:`, reason);
      state.twitch.connected = false;
      state.twitch.connecting = false;
      broadcastStatus();
    });

    client.connect().catch((err) => {
      if (state.twitch.client !== client) return;
      console.error('[Twitch] Error al conectar:', err.message || err);
      state.twitch.connected = false;
      state.twitch.connecting = false;
      state.twitch.error = err.message || 'Error de conexión a Twitch';
      broadcastStatus();
    });

  } catch (err) {
    state.twitch.connected = false;
    state.twitch.connecting = false;
    state.twitch.error = err.message;
    broadcastStatus();
  }
}

function disconnectTwitch(shouldBroadcast = true) {
  if (state.twitch.client) {
    const oldClient = state.twitch.client;
    state.twitch.client = null;
    try {
      oldClient.removeAllListeners();
      oldClient.disconnect();
    } catch (_) {}
  }
  state.twitch.connected = false;
  state.twitch.connecting = false;
  state.twitch.viewers = 0;
  state.twitch.isLive = false;
  state.twitch.error = null;
  if (shouldBroadcast) broadcastStatus();
}

// -------------------------------------------------------------

    return { fetchTwitchViewers, connectTwitch, disconnectTwitch };
};
