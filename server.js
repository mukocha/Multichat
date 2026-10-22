const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const dns = require('dns');
const { TikTokLiveConnection, RouteConfig } = require('tiktok-live-connector');
const tmi = require('tmi.js');
const { validateConfigPatch } = require('./lib/config');
const { saveUpload } = require('./lib/upload');
const { logPollError } = require('./lib/logger');
const registerApiRoutes = require('./routes/api');
const startAutoPolling = require('./services/polling');

// Corrección de DNS para resolver dominios de TikTok y streaming ante bloqueos de ISP
const dnsResolver = new dns.Resolver();
dnsResolver.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);

const origLookup = dns.lookup.bind(dns);
dns.lookup = function(hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  origLookup(hostname, options, (err, address, family) => {
    if (err && (err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN')) {
      dnsResolver.resolve4(hostname, (resErr, addresses) => {
        if (!resErr && addresses && addresses.length > 0) {
          if (options.all) {
            return callback(null, addresses.map(addr => ({ address: addr, family: 4 })));
          }
          return callback(null, addresses[0], 4);
        }
        return callback(err);
      });
    } else {
      return callback(err, address, family);
    }
  });
};

// Prevenir errores con el endpoint de pago (Business Plan) de EulerStream
RouteConfig.fetchRoomGifts = async () => [];
RouteConfig.fetchRoomGiftsFromProvider = async () => ({ data: { gifts: [] } });
RouteConfig.fetchWebcastSignatureFromProvider = async () => ({
  status: 200,
  response: {}
});

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingInterval: 10000,
  pingTimeout: 20000,
  connectTimeout: 30000
});

// Evitar que errores internos de conectores externos (ej. TikTok/Kick WS) tumben el proceso en Render
process.on('uncaughtException', (err) => {
  console.error('[Guard] Excepción no capturada prevenida:', err?.message || err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[Guard] Promesa rechazada prevenida:', reason?.message || reason);
});

const PORT = process.env.PORT || 3000;
const CONFIG_FILE = path.join(__dirname, 'config.json');

// Middleware
app.use(cors());
app.use(express.json({ limit: '35mb' }));
app.use(express.urlencoded({ extended: true, limit: '35mb' }));
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// Estado de conexión
const state = {
  kick: {
    connected: false,
    connecting: false,
    username: '',
    channelId: null,
    chatroomId: null,
    viewers: 0,
    followersCount: null,
    lastFollowAlertTime: 0,
    isLive: false,
    error: null,
    ws: null,
    pingInterval: null
  },
  tiktok: {
    connected: false,
    connecting: false,
    username: '',
    viewers: 0,
    isLive: false,
    error: null,
    connector: null
  },
  twitch: {
    connected: false,
    connecting: false,
    username: '',
    viewers: 0,
    followersCount: null,
    lastFollowAlertTime: 0,
    isLive: false,
    error: null,
    client: null
  },
  youtube: {
    connected: false,
    connecting: false,
    username: '',
    viewers: 0,
    isLive: false,
    error: null
  }
};

// Historial en memoria de las últimas notificaciones (se borran automáticamente a los 10 minutos)
const ALERT_TTL_MS = 10 * 60 * 1000; // 10 minutos
const alertHistory = [];

function cleanExpiredAlerts() {
  const cutoff = Date.now() - ALERT_TTL_MS;
  for (let i = alertHistory.length - 1; i >= 0; i--) {
    if (alertHistory[i].timestamp && alertHistory[i].timestamp < cutoff) {
      alertHistory.splice(i, 1);
    }
  }
}

function dispatchAlert(alertData) {
  alertData.timestamp = alertData.timestamp || Date.now();
  cleanExpiredAlerts();
  alertHistory.unshift(alertData);
  if (alertHistory.length > 100) alertHistory.pop();
  console.log(`[ALERTA REGISTRADA] [${alertData.platform.toUpperCase()}] ${alertData.title} - ${alertData.user}: ${alertData.detail}`);
  io.emit('alert', alertData);
}

// Cargar configuración persistente
function loadConfig() {
  let cfg = {
    kickUsername: process.env.KICK_USERNAME || '',
    tiktokUsername: process.env.TIKTOK_USERNAME || '',
    twitchUsername: process.env.TWITCH_USERNAME || '',
    youtubeChannel: process.env.YOUTUBE_CHANNEL || '',
    alertSound: true,
    alertVolume: 80,
    alertDuration: 5,
    chatTheme: 'transparent',
    chatFontSize: 16,
    chatFadeTimeout: 0,
    alertMedia: {
      kick_follow: { image: '', sound: '' },
      kick_sub: { image: '', sound: '' },
      kick_giftsub: { image: '', sound: '' },
      kick_host: { image: '', sound: '' },
      kick_raid: { image: '', sound: '' },
      tiktok_follow: { image: '', sound: '' },
      tiktok_gift_rose: { image: '', sound: '' },
      tiktok_gift_lion: { image: '', sound: '' },
      twitch_follow: { image: '', sound: '' },
      twitch_sub: { image: '', sound: '' },
      twitch_host: { image: '', sound: '' },
      twitch_raid: { image: '', sound: '' },
      youtube_sub: { image: '', sound: '' },
      youtube_member: { image: '', sound: '' },
      youtube_superchat: { image: '', sound: '' },
      follow: { image: '', sound: '' },
      sub: { image: '', sound: '' },
      gift: { image: '', sound: '' },
      host: { image: '', sound: '' },
      raid: { image: '', sound: '' }
    },
    customCss: '',
    customHtml: '',
    customJs: ''
  };

  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const fileData = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      const validation = validateConfigPatch(fileData);
      if (validation.error) throw new Error(validation.error);
      cfg = {
        ...cfg,
        ...validation.value,
        alertMedia: {
          ...cfg.alertMedia,
          ...(validation.value.alertMedia || {})
        }
      };
    }
  } catch (err) {
    console.error('Error al leer config.json:', err);
  }

  // Las variables de entorno de Render tienen máxima prioridad (inmunes a reinicios o disco efímero)
  if (process.env.KICK_USERNAME && process.env.KICK_USERNAME.trim()) cfg.kickUsername = process.env.KICK_USERNAME.trim();
  if (process.env.TIKTOK_USERNAME && process.env.TIKTOK_USERNAME.trim()) cfg.tiktokUsername = process.env.TIKTOK_USERNAME.trim();
  if (process.env.TWITCH_USERNAME && process.env.TWITCH_USERNAME.trim()) cfg.twitchUsername = process.env.TWITCH_USERNAME.trim();
  if (process.env.YOUTUBE_CHANNEL && process.env.YOUTUBE_CHANNEL.trim()) cfg.youtubeChannel = process.env.YOUTUBE_CHANNEL.trim();

  return cfg;
}

function saveConfig(cfg) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
  } catch (err) {
    console.error('Error al guardar config.json:', err);
  }
}

// Paleta de colores vivos y de alto contraste para usuarios del chat
const VIBRANT_CHAT_COLORS = [
  '#00e5ff', '#38bdf8', '#53fc18', '#a3e635', '#facc15',
  '#fb923c', '#f87171', '#ff007f', '#ec4899', '#c084fc',
  '#a855f7', '#818cf8', '#60a5fa', '#2dd4bf', '#34d399'
];

function getDeterministicColor(str) {
  if (!str) return '#38bdf8';
  let hash = 0;
  const s = String(str).toLowerCase();
  for (let i = 0; i < s.length; i++) {
    hash = s.charCodeAt(i) + ((hash << 5) - hash);
  }
  return VIBRANT_CHAT_COLORS[Math.abs(hash) % VIBRANT_CHAT_COLORS.length];
}

let currentConfig = loadConfig();

function getViewersPayload() {
  return {
    kick: {
      viewers: state.kick.viewers || 0,
      isLive: Boolean(state.kick.isLive || state.kick.connected),
      connected: Boolean(state.kick.connected),
      username: state.kick.username || currentConfig.kickUsername || ''
    },
    tiktok: {
      viewers: state.tiktok.viewers || 0,
      isLive: Boolean(state.tiktok.isLive || state.tiktok.connected),
      connected: Boolean(state.tiktok.connected),
      username: state.tiktok.username || currentConfig.tiktokUsername || ''
    },
    twitch: {
      viewers: state.twitch.viewers || 0,
      isLive: Boolean(state.twitch.isLive || state.twitch.connected),
      connected: Boolean(state.twitch.connected),
      username: state.twitch.username || currentConfig.twitchUsername || ''
    },
    youtube: {
      viewers: state.youtube.viewers || 0,
      isLive: Boolean(state.youtube.isLive || state.youtube.connected),
      connected: Boolean(state.youtube.connected),
      username: state.youtube.username || currentConfig.youtubeChannel || ''
    },
    total: (state.kick.viewers || 0) + (state.tiktok.viewers || 0) + (state.twitch.viewers || 0) + (state.youtube.viewers || 0)
  };
}

function getStatusPayload() {
  return {
    kick: {
      connected: state.kick.connected,
      connecting: state.kick.connecting,
      username: state.kick.username || currentConfig.kickUsername || '',
      viewers: state.kick.viewers || 0,
      isLive: Boolean(state.kick.isLive || state.kick.connected),
      error: state.kick.error
    },
    tiktok: {
      connected: state.tiktok.connected,
      connecting: state.tiktok.connecting,
      username: state.tiktok.username || currentConfig.tiktokUsername || '',
      viewers: state.tiktok.viewers || 0,
      isLive: Boolean(state.tiktok.isLive || state.tiktok.connected),
      error: state.tiktok.error
    },
    twitch: {
      connected: state.twitch.connected,
      connecting: state.twitch.connecting,
      username: state.twitch.username || currentConfig.twitchUsername || '',
      viewers: state.twitch.viewers || 0,
      isLive: Boolean(state.twitch.isLive || state.twitch.connected),
      error: state.twitch.error
    },
    youtube: {
      connected: state.youtube.connected,
      connecting: state.youtube.connecting,
      username: state.youtube.username || currentConfig.youtubeChannel || '',
      viewers: state.youtube.viewers || 0,
      isLive: Boolean(state.youtube.isLive || state.youtube.connected),
      error: state.youtube.error
    }
  };
}

function broadcastViewers() {
  io.emit('viewers:update', getViewersPayload());
}

function broadcastStatus() {
  io.emit('status:update', getStatusPayload());
  broadcastViewers();
}

// Caché en memoria y persistente de IDs de Kick para reconectar al instante aunque Cloudflare limite peticiones
const kickChannelCache = {};

let fetchKickChannelData, fetchTwitchViewers, fetchYouTubeViewers, fetchTikTokLiveRoomData;
let connectKick, disconnectKick, connectTikTok, disconnectTikTok;
let connectTwitch, disconnectTwitch, connectYouTube, disconnectYouTube;
const platformContext = {
  state, io, broadcastStatus, broadcastViewers, saveConfig, dispatchAlert,
  getDeterministicColor, execFile, TikTokLiveConnection, RouteConfig, tmi, logPollError,
  getConfig: () => currentConfig
};
Object.assign(platformContext, require('./platforms/kick')(platformContext));
Object.assign(platformContext, require('./platforms/tiktok')(platformContext));
Object.assign(platformContext, require('./platforms/twitch')(platformContext));
Object.assign(platformContext, require('./platforms/youtube')(platformContext));
({ fetchKickChannelData, fetchTwitchViewers, fetchYouTubeViewers, fetchTikTokLiveRoomData,
   connectKick, disconnectKick, connectTikTok, disconnectTikTok, connectTwitch, disconnectTwitch,
   connectYouTube, disconnectYouTube } = platformContext);

// -------------------------------------------------------------
// BUCLE DE AUTO-RECONEXIÓN Y DETECCIÓN AUTOMÁTICA DE STREAM
// -------------------------------------------------------------
// ENDPOINTS REST
// -------------------------------------------------------------

registerApiRoutes({
  app, io, state, getStatusPayload, getViewersPayload, broadcastStatus, broadcastViewers,
  validateConfigPatch, getConfig: () => currentConfig, setConfig: (value) => { currentConfig = value; },
  saveConfig, path, projectDir: __dirname, saveUpload, cleanExpiredAlerts, alertHistory,
  connectKick, disconnectKick, connectTikTok, disconnectTikTok, connectTwitch, disconnectTwitch,
  connectYouTube, disconnectYouTube, dispatchAlert, getDeterministicColor
});

io.on('connection', (socket) => {
  socket.emit('status:update', getStatusPayload());
  socket.emit('viewers:update', getViewersPayload());
  socket.emit('config:update', currentConfig);

  // Enviar historial de notificaciones no vencidas al cliente que se conecta
  cleanExpiredAlerts();
  socket.emit('alert:history', alertHistory);
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err?.type === 'entity.too.large') return res.status(413).json({ ok: false, error: 'La solicitud supera el límite permitido.' });
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ ok: false, error: 'El cuerpo JSON de la solicitud no es válido.' });
  }
  console.error('[HTTP] Error procesando solicitud:', err?.message || err);
  res.status(500).json({ ok: false, error: 'Error interno del servidor.' });
});

// Iniciar servidor
server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` 🚀 StreamOverlay activo 24/7 en puerto ${PORT}`);
  console.log(` - Panel de Control:    http://localhost:${PORT}/`);
  console.log(` - Multichat para OBS:  http://localhost:${PORT}/chat.html`);
  console.log(` - Alertas para OBS:    http://localhost:${PORT}/alerts.html`);
  console.log(` - Panel Dock para OBS: http://localhost:${PORT}/dock.html`);
  console.log(` - Feed de Alertas OBS: http://localhost:${PORT}/events.html`);
  console.log(`====================================================`);

  if (currentConfig.kickUsername) {
    connectKick(currentConfig.kickUsername);
  }
  if (currentConfig.tiktokUsername) {
    connectTikTok(currentConfig.tiktokUsername);
  }
  if (currentConfig.twitchUsername) {
    connectTwitch(currentConfig.twitchUsername);
  }
  if (currentConfig.youtubeChannel) {
    connectYouTube(currentConfig.youtubeChannel);
  }

  startAutoPolling({
    state, io, connectTikTok, disconnectTikTok, fetchTikTokLiveRoomData,
    connectKick, connectTwitch, fetchYouTubeViewers,
    broadcastViewers, fetchKickChannelData, dispatchAlert, fetchTwitchViewers,
    cleanExpiredAlerts, alertHistory, getConfig: () => currentConfig, logPollError
  });
});
