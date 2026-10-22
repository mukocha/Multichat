const CONFIG_KEYS = new Set([
  'kickUsername', 'tiktokUsername', 'twitchUsername', 'youtubeChannel',
  'alertSound', 'alertVolume', 'alertDuration', 'chatTheme', 'chatFontSize',
  'chatFadeTimeout', 'alertMedia', 'customCss', 'customHtml', 'customJs', 'kickCache'
]);

const MEDIA_KEY = /^[a-z0-9_-]{1,64}$/i;
const MEDIA_VALUE_LIMIT = 35 * 1024 * 1024;
const TEXT_LIMITS = { customCss: 200000, customHtml: 200000, customJs: 200000 };
const SETTING_VALUES = {
  chatTheme: new Set(['transparent', 'glass', 'solid'])
};

function validMediaUrl(value) {
  return value === '' ||
    /^\/uploads\/[a-z0-9._-]+$/i.test(value) ||
    /^https?:\/\/[^\s]+$/i.test(value) ||
    /^data:(image|audio)\/[a-z0-9.+-]+;base64,/i.test(value);
}

function validateConfigPatch(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { error: 'La configuración debe ser un objeto JSON.' };
  }

  const result = {};
  for (const [key, value] of Object.entries(input)) {
    if (!CONFIG_KEYS.has(key)) return { error: `Campo de configuración no permitido: ${key}.` };
    if (TEXT_LIMITS[key]) {
      if (typeof value !== 'string' || value.length > TEXT_LIMITS[key]) {
        return { error: `${key} debe ser texto de hasta ${TEXT_LIMITS[key]} caracteres.` };
      }
      result[key] = value;
      continue;
    }

    if (['kickUsername', 'tiktokUsername', 'twitchUsername', 'youtubeChannel', 'chatTheme'].includes(key)) {
      if (typeof value !== 'string' || value.length > 256) return { error: `${key} debe ser texto de hasta 256 caracteres.` };
      if (SETTING_VALUES.chatTheme && key === 'chatTheme' && !SETTING_VALUES.chatTheme.has(value)) return { error: 'chatTheme no es un tema disponible.' };
      result[key] = value.trim();
    } else if (['alertSound'].includes(key)) {
      if (typeof value !== 'boolean') return { error: `${key} debe ser booleano.` };
      result[key] = value;
    } else if (['alertVolume', 'alertDuration', 'chatFontSize', 'chatFadeTimeout'].includes(key)) {
      const bounds = { alertVolume: [0, 100], alertDuration: [1, 60], chatFontSize: [8, 64], chatFadeTimeout: [0, 3600] }[key];
      if (!Number.isFinite(value) || value < bounds[0] || value > bounds[1]) return { error: `${key} debe estar entre ${bounds[0]} y ${bounds[1]}.` };
      if (SETTING_VALUES[key] && !SETTING_VALUES[key].has(value)) return { error: `${key} tiene un valor no disponible.` };
      result[key] = value;
    } else if (key === 'alertMedia') {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return { error: 'alertMedia debe ser un objeto.' };
      const media = {};
      for (const [mediaKey, item] of Object.entries(value)) {
        if (!MEDIA_KEY.test(mediaKey) || ['__proto__', 'constructor', 'prototype'].includes(mediaKey.toLowerCase()) || !item || typeof item !== 'object' || Array.isArray(item)) return { error: 'Hay una entrada inválida en alertMedia.' };
        media[mediaKey] = {};
        for (const field of ['image', 'sound']) {
          if (item[field] !== undefined) {
            if (typeof item[field] !== 'string' || item[field].length > MEDIA_VALUE_LIMIT || !validMediaUrl(item[field])) return { error: `alertMedia.${mediaKey}.${field} debe ser una URL HTTP(S) o una ruta de /uploads.` };
            media[mediaKey][field] = item[field];
          }
        }
      }
      result.alertMedia = media;
    } else if (key === 'kickCache') {
      if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > 500) return { error: 'kickCache no es válido.' };
      const cache = {};
      for (const [name, entry] of Object.entries(value)) {
        if (!/^[a-z0-9_]{1,64}$/i.test(name) || !entry || !Number.isSafeInteger(entry.channelId) || !Number.isSafeInteger(entry.chatroomId)) return { error: 'kickCache contiene una entrada inválida.' };
        cache[name] = { channelId: entry.channelId, chatroomId: entry.chatroomId };
      }
      result.kickCache = cache;
    }
  }
  return { value: result };
}

module.exports = { validateConfigPatch };
