module.exports = function createPlatform(context) {
  const { state, io, broadcastStatus, broadcastViewers, saveConfig, dispatchAlert, getDeterministicColor, execFile, TikTokLiveConnection, RouteConfig, tmi, getConfig, logPollError } = context;
// CONECTOR Y VIEWERS DE YOUTUBE LIVE (Scraping directo sin API Key)
// -------------------------------------------------------------
function fetchYouTubeViewers(channelInput) {
  if (!channelInput) return Promise.resolve({ viewers: 0, isLive: false });
  let clean = channelInput.trim();
  clean = clean.replace(/^https?:\/\/(www\.)?youtube\.com\//, '');
  clean = clean.replace(/\/live.*$/, '');
  clean = clean.replace(/\/$/, '');

  let liveUrl = '';
  if (clean.startsWith('@')) {
    liveUrl = `https://www.youtube.com/${clean}/live`;
  } else if (clean.startsWith('channel/') || clean.startsWith('c/') || clean.startsWith('user/')) {
    liveUrl = `https://www.youtube.com/${clean}/live`;
  } else if (clean.length === 24 && clean.startsWith('UC')) {
    liveUrl = `https://www.youtube.com/channel/${clean}/live`;
  } else {
    liveUrl = `https://www.youtube.com/@${clean}/live`;
  }

  const curlCmd = process.platform === 'win32' ? 'curl.exe' : 'curl';

  return new Promise((resolve) => {
    execFile(curlCmd, [
      '-s', '-L', liveUrl,
      '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      '-H', 'Accept-Language: en-US,en;q=0.9'
    ], { maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
      const parseHtml = (html) => {
        if (!html) return { viewers: 0, isLive: false };
        const isLive = html.includes('"isLive":true') || html.includes('"isLiveNow":true') || html.includes('watching now') || html.includes('espectadores') || html.includes('watching');

        const mWatching = html.match(/"videoViewCountRenderer":\{"viewCount":\{"runs":\[\{"text":"([0-9.,\s]+)"\}/);
        const mRuns = html.match(/"viewCount":\{"runs":\[\{"text":"([0-9.,\s]+)"\}/);
        const mSimple = html.match(/"viewCount":\{"simpleText":"([0-9.,\s]+)/);
        const mRegexText = html.match(/([0-9][0-9.,]*)\s+(watching now|watching|espectadores|en directo)/i);
        const mOriginal = html.match(/"originalViewCount":"(\d+)"/);

        const raw = mWatching?.[1] || mRuns?.[1] || mSimple?.[1] || mRegexText?.[1] || mOriginal?.[1];
        let viewers = 0;
        if (raw) {
          const num = parseInt(raw.replace(/[^0-9]/g, ''), 10);
          if (!isNaN(num)) viewers = num;
        }
        return { viewers, isLive: isLive && viewers > 0 };
      };

      if (!err && stdout) {
        return resolve(parseHtml(stdout));
      }

      fetch(liveUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      })
      .then(r => r.text())
      .then(html => resolve(parseHtml(html)))
      .catch(err => {
        logPollError('youtube', 'consulta de estado en vivo', err);
        resolve({ viewers: 0, isLive: false });
      });
    });
  });
}

function connectYouTube(channel) {
  if (!channel) return;
  channel = channel.trim();
  disconnectYouTube();

  state.youtube.username = channel;
  state.youtube.connecting = true;
  state.youtube.connected = true;
  state.youtube.error = null;
  broadcastStatus();

  console.log(`[YouTube] Monitoreando espectadores de canal '${channel}'...`);
  fetchYouTubeViewers(channel).then(({ viewers, isLive }) => {
    state.youtube.connecting = false;
    state.youtube.viewers = viewers;
    state.youtube.isLive = isLive;
    broadcastStatus();
    broadcastViewers();
  });
}

function disconnectYouTube() {
  state.youtube.connected = false;
  state.youtube.connecting = false;
  state.youtube.viewers = 0;
  state.youtube.isLive = false;
  state.youtube.error = null;
  broadcastStatus();
}

// -------------------------------------------------------------

    return { fetchYouTubeViewers, connectYouTube, disconnectYouTube };
};
