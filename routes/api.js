module.exports = function registerApiRoutes(context) {
  const { app, io, state, getStatusPayload, getViewersPayload, broadcastStatus, broadcastViewers,
    validateConfigPatch, getConfig, setConfig, saveConfig, path, projectDir, saveUpload,
    cleanExpiredAlerts, alertHistory, connectKick, disconnectKick, connectTikTok, disconnectTikTok,
    connectTwitch, disconnectTwitch, connectYouTube, disconnectYouTube, dispatchAlert, getDeterministicColor } = context;
app.get('/api/ping', (req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

app.get('/api/status', (req, res) => {
  res.json(getStatusPayload());
});

app.get('/api/viewers', (req, res) => {
  res.json(getViewersPayload());
});

app.post('/api/test-viewers', (req, res) => {
  const { kick = 45, tiktok = 120, twitch = 60, youtube = 35 } = req.body || {};
  const values = { kick, tiktok, twitch, youtube };
  for (const [platform, value] of Object.entries(values)) {
    if (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 10000000) {
      return res.status(400).json({ ok: false, error: `El conteo de ${platform} debe ser un número entre 0 y 10000000.` });
    }
  }
  state.kick.viewers = parseInt(kick, 10) || 0;
  state.kick.isLive = state.kick.viewers > 0;
  state.tiktok.viewers = parseInt(tiktok, 10) || 0;
  state.tiktok.isLive = state.tiktok.viewers > 0;
  state.twitch.viewers = parseInt(twitch, 10) || 0;
  state.twitch.isLive = state.twitch.viewers > 0;
  state.youtube.viewers = parseInt(youtube, 10) || 0;
  state.youtube.isLive = state.youtube.viewers > 0;
  broadcastViewers();
  broadcastStatus();
  res.json({
    ok: true,
    viewers: {
      kick: state.kick.viewers,
      tiktok: state.tiktok.viewers,
      twitch: state.twitch.viewers,
      youtube: state.youtube.viewers,
      total: state.kick.viewers + state.tiktok.viewers + state.twitch.viewers + state.youtube.viewers
    }
  });
});

app.get('/api/config', (req, res) => {
  res.json(getConfig());
});

app.post('/api/config', (req, res) => {
  const validation = validateConfigPatch(req.body || {});
  if (validation.error) return res.status(400).json({ ok: false, error: validation.error });
  const incoming = validation.value;
  const mergedAlertMedia = { ...(getConfig().alertMedia || {}) };
  if (incoming.alertMedia) {
    for (const [k, v] of Object.entries(incoming.alertMedia)) {
      mergedAlertMedia[k] = {
        ...(mergedAlertMedia[k] || {}),
        ...v
      };
    }
  }
  setConfig({
    ...getConfig(),
    ...incoming,
    alertMedia: mergedAlertMedia
  });
  saveConfig(getConfig());
  io.emit('config:update', getConfig());
  res.json({ ok: true, config: getConfig() });
});

// Subida de archivos para personalización (audios, imágenes, gifs)
app.post('/api/upload', (req, res) => {
  try {
    const uploadsDir = path.join(projectDir, 'public', 'uploads');
    const result = saveUpload(req.body || {}, uploadsDir);
    if (result.error) return res.status(result.status).json({ ok: false, error: result.error });
    console.log(`[UPLOAD] Archivo guardado: ${result.url}`);
    res.json({ ok: true, url: result.url, dataUrl: req.body.data, filename: result.filename });
  } catch (err) {
    console.error('[UPLOAD] Error procesando archivo:', err);
    res.status(500).json({ ok: false, error: 'No se pudo guardar el archivo.' });
  }
});

// Obtener historial de alertas (máximo 10 minutos de antigüedad)
app.get('/api/alerts', (req, res) => {
  cleanExpiredAlerts();
  res.json(alertHistory);
});

// Limpiar historial de alertas
app.post('/api/alerts/clear', (req, res) => {
  alertHistory.length = 0;
  io.emit('alert:history', []);
  res.json({ ok: true });
});

app.post('/api/connect', async (req, res) => {
  const { kickUsername, tiktokUsername, twitchUsername, youtubeChannel, force } = req.body || {};
  for (const [key, value] of Object.entries({ kickUsername, tiktokUsername, twitchUsername, youtubeChannel })) {
    if (value !== undefined && (typeof value !== 'string' || value.length > 256)) {
      return res.status(400).json({ ok: false, error: `${key} debe ser texto de hasta 256 caracteres.` });
    }
  }
  if (force !== undefined && typeof force !== 'boolean') return res.status(400).json({ ok: false, error: 'force debe ser booleano.' });

  if (kickUsername !== undefined) {
    const cleanKick = kickUsername.trim();
    getConfig().kickUsername = cleanKick;
    if (cleanKick) {
      const alreadyActive = (state.kick.connected || state.kick.connecting) &&
        state.kick.username.toLowerCase() === cleanKick.toLowerCase();
      if (!alreadyActive || force) {
        connectKick(cleanKick);
      }
    } else {
      state.kick.username = '';
      disconnectKick();
    }
  }

  if (tiktokUsername !== undefined) {
    const cleanTikTok = tiktokUsername.trim().replace(/^@/, '');
    getConfig().tiktokUsername = cleanTikTok;
    if (cleanTikTok) {
      const alreadyActive = (state.tiktok.connected || state.tiktok.connecting) &&
        state.tiktok.username.toLowerCase() === cleanTikTok.toLowerCase();
      if (!alreadyActive || force) {
        connectTikTok(cleanTikTok);
      }
    } else {
      state.tiktok.username = '';
      disconnectTikTok();
    }
  }

  if (twitchUsername !== undefined) {
    const cleanTwitch = twitchUsername.trim().toLowerCase().replace(/^#/, '').replace(/^https?:\/\/.*twitch\.tv\//, '');
    getConfig().twitchUsername = cleanTwitch;
    if (cleanTwitch) {
      const alreadyActive = (state.twitch.connected || state.twitch.connecting) &&
        state.twitch.username.toLowerCase() === cleanTwitch.toLowerCase();
      if (!alreadyActive || force) {
        connectTwitch(cleanTwitch);
      }
    } else {
      state.twitch.username = '';
      disconnectTwitch();
    }
  }

  if (youtubeChannel !== undefined) {
    const cleanYT = youtubeChannel.trim();
    getConfig().youtubeChannel = cleanYT;
    if (cleanYT) {
      const alreadyActive = (state.youtube.connected || state.youtube.connecting) &&
        state.youtube.username.toLowerCase() === cleanYT.toLowerCase();
      if (!alreadyActive || force) {
        connectYouTube(cleanYT);
      }
    } else {
      state.youtube.username = '';
      disconnectYouTube();
    }
  }

  saveConfig(getConfig());
  io.emit('config:update', getConfig());
  broadcastStatus();
  res.json({ ok: true, config: getConfig() });
});

app.post('/api/disconnect', (req, res) => {
  const { platform } = req.body || {};
  if (platform !== undefined && !['kick', 'tiktok', 'twitch', 'youtube', 'all'].includes(platform)) {
    return res.status(400).json({ ok: false, error: 'Plataforma inválida.' });
  }
  if (!platform || platform === 'kick' || platform === 'all') disconnectKick();
  if (!platform || platform === 'tiktok' || platform === 'all') disconnectTikTok();
  if (!platform || platform === 'twitch' || platform === 'all') disconnectTwitch();
  if (!platform || platform === 'youtube' || platform === 'all') disconnectYouTube();
  res.json({ ok: true });
});

// Enviar alerta de prueba para calibrar OBS
app.post('/api/test-alert', (req, res) => {
  const { platform = 'kick', type = 'follow', user, title, detail, gift, viewers } = req.body || {};
  if (!['kick', 'tiktok', 'twitch', 'youtube'].includes(platform) || typeof type !== 'string' || type.length > 64) {
    return res.status(400).json({ ok: false, error: 'Plataforma o tipo de alerta inválido.' });
  }
  for (const [field, value, max] of [['user', user, 100], ['title', title, 200], ['detail', detail, 500]]) {
    if (value !== undefined && (typeof value !== 'string' || value.length > max)) {
      return res.status(400).json({ ok: false, error: `${field} debe ser texto de hasta ${max} caracteres.` });
    }
  }

  let defaultUser = platform === 'kick' ? 'KickViewer_99' : (platform === 'twitch' ? 'TwitchFan_77' : (platform === 'youtube' ? 'YouTubeFan_24' : 'TikTokFan_10'));
  const chosenUser = user || defaultUser;
  let defaultTitle = '¡Nueva Alerta!';
  let defaultDetail = `${chosenUser} ha interactuado en el canal`;

  if (type === 'follow') {
    defaultTitle = platform === 'kick' ? '¡Nuevo Seguidor en Kick!' : (platform === 'twitch' ? '¡Nuevo Seguidor en Twitch!' : (platform === 'youtube' ? '¡Nuevo Suscriptor en YouTube!' : '¡Nuevo Seguidor en TikTok!'));
    defaultDetail = `${chosenUser} ahora te sigue en directo 💖`;
  } else if (type === 'sub' || type === 'subscription') {
    defaultTitle = platform === 'kick' ? '¡Nueva Suscripción en Kick!' : (platform === 'twitch' ? '¡Nueva Suscripción en Twitch!' : (platform === 'youtube' ? '¡Nuevo Miembro en YouTube!' : '¡Nueva Suscripción!'));
    defaultDetail = `${chosenUser} se ha suscrito al canal (Tier 1) ⭐`;
  } else if (type === 'member' || type === 'membership') {
    defaultTitle = '¡Nuevo Miembro del Canal!';
    defaultDetail = `${chosenUser} se unió a las membresías del canal ⭐`;
  } else if (type === 'superchat' || type === 'super_chat') {
    defaultTitle = '¡Super Chat en YouTube!';
    defaultDetail = detail || `${chosenUser} envió un Super Chat de $10.00 USD 💸`;
  } else if (type === 'giftsub') {
    defaultTitle = '¡Suscripciones Regaladas!';
    defaultDetail = `${chosenUser} regaló 5 suscripciones a la comunidad ⭐`;
  } else if (type === 'gift') {
    if (platform === 'youtube') {
      defaultTitle = '¡Super Chat en YouTube!';
      defaultDetail = detail || `${chosenUser} envió un Super Chat de $10.00 USD 💸`;
    } else {
      defaultTitle = '¡Regalo en TikTok!';
      defaultDetail = detail || `${chosenUser} envió Rosa x10 (10 🪙) 🌹`;
    }
  } else if (type === 'host') {
    const vCount = viewers || 38;
    defaultTitle = platform === 'kick' ? '¡Host en Kick!' : '¡Host en Twitch!';
    defaultDetail = `${chosenUser} te está hosteando con ${vCount} espectadores 📡`;
  } else if (type === 'raid') {
    const vCount = viewers || 54;
    defaultTitle = platform === 'kick' ? '¡Raid en Kick!' : '¡Raid en Twitch!';
    defaultDetail = `${chosenUser} llegó con una raid de ${vCount} espectadores 🚀`;
  }

  const alertData = {
    id: `test-alert-${Date.now()}`,
    platform: platform,
    type: type,
    user: user || defaultUser,
    title: title || defaultTitle,
    detail: detail || defaultDetail,
    gift: gift || null,
    isTest: true,
    timestamp: Date.now()
  };

  dispatchAlert(alertData);
  res.json({ ok: true, alert: alertData });
});

// Enviar mensaje de chat de prueba
app.post('/api/test-chat', (req, res) => {
  const { platform = 'kick', user, message } = req.body || {};
  if (!['kick', 'tiktok', 'twitch', 'youtube'].includes(platform)) return res.status(400).json({ ok: false, error: 'Plataforma inválida.' });
  if (user !== undefined && (typeof user !== 'string' || user.length > 100)) return res.status(400).json({ ok: false, error: 'El usuario debe tener hasta 100 caracteres.' });
  if (message !== undefined && (typeof message !== 'string' || message.length > 1000)) return res.status(400).json({ ok: false, error: 'El mensaje debe tener hasta 1000 caracteres.' });

  let defaultUser = 'KickGamer';
  let defaultMsg = '¡Hola desde Kick! Saludos al stream 🟢';
  let defaultBadges = ['moderator', 'subscriber'];

  if (platform === 'tiktok') {
    defaultUser = 'TikTokUser';
    defaultMsg = '¡Saludos desde TikTok! 🎉🔥';
    defaultBadges = ['Top 1 Fan'];
  } else if (platform === 'twitch') {
    defaultUser = 'TwitchViewer';
    defaultMsg = '¡Hola a todos desde Twitch! 🟣🎮';
    defaultBadges = ['subscriber', 'vip'];
  } else if (platform === 'youtube') {
    defaultUser = 'YouTubeFan';
    defaultMsg = '¡Saludos desde YouTube Live! Todo activo 🔴⚡';
    defaultBadges = ['subscriber', 'member'];
  }

  const chatMsg = {
    id: `test-chat-${Date.now()}`,
    platform: platform,
    user: user || defaultUser,
    nickname: user || defaultUser,
    message: message || defaultMsg,
    color: getDeterministicColor(user || defaultUser),
    avatar: '',
    badges: defaultBadges,
    isTest: true,
    timestamp: Date.now()
  };

  console.log(`[TEST CHAT] Mensaje de prueba (${platform}):`, chatMsg.message);
  io.emit('chat:message', chatMsg);
  res.json({ ok: true, message: chatMsg });
});

// WebSocket de Socket.IO con el navegador y OBS

};
