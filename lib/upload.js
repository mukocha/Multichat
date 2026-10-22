const fs = require('fs');
const path = require('path');

const MIME_EXTENSIONS = new Map([
  ['image/gif', '.gif'], ['image/png', '.png'], ['image/jpeg', '.jpg'], ['image/webp', '.webp'],
  ['audio/mpeg', '.mp3'], ['audio/mp3', '.mp3'], ['audio/x-mp3', '.mp3'], ['audio/wav', '.wav'], ['audio/x-wav', '.wav'],
  ['audio/ogg', '.ogg'], ['audio/vorbis', '.ogg'], ['audio/m4a', '.m4a'], ['audio/mp4', '.m4a'], ['audio/aac', '.m4a'], ['audio/x-m4a', '.m4a']
]);
const MAX_FILE_BYTES = 25 * 1024 * 1024;

function matchesFileSignature(buffer, mime) {
  if (mime === 'image/png') return buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mime === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mime === 'image/gif') return buffer.subarray(0, 6).toString('ascii').match(/^GIF8[79]a$/) !== null;
  if (mime === 'image/webp') return buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  if (mime === 'audio/wav' || mime === 'audio/x-wav') return buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WAVE';
  if (mime === 'audio/ogg' || mime === 'audio/vorbis') return buffer.toString('ascii', 0, 4) === 'OggS';
  if (mime.startsWith('audio/')) return buffer.toString('ascii', 0, 3) === 'ID3' || (buffer.length > 1 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) || buffer.toString('ascii', 4, 8) === 'ftyp';
  return false;
}

function saveUpload({ data, type }, uploadsDir) {
  if (typeof data !== 'string') return { status: 400, error: 'No se enviaron datos de archivo.' };
  const match = /^data:([^;,]+);base64,([a-z0-9+/=\r\n]+)$/i.exec(data);
  if (!match) return { status: 400, error: 'El archivo debe enviarse como Data URL base64.' };
  const mime = match[1].toLowerCase();
  const ext = MIME_EXTENSIONS.get(mime);
  if (!ext) return { status: 400, error: 'Formato no soportado. Usa GIF, PNG, JPG, WEBP, MP3, WAV, OGG o M4A.' };
  const encoded = match[2].replace(/\s/g, '');
  if (!encoded || encoded.length > Math.ceil(MAX_FILE_BYTES / 3) * 4 + 4 || encoded.length % 4 !== 0) {
    return { status: 413, error: 'El archivo está vacío o supera el límite permitido.' };
  }
  const buffer = Buffer.from(encoded, 'base64');
  if (!buffer.length || buffer.length > MAX_FILE_BYTES) {
    return { status: 413, error: 'El archivo base64 no es válido o supera el límite permitido.' };
  }
  if (!matchesFileSignature(buffer, mime)) return { status: 400, error: 'El contenido del archivo no coincide con el formato declarado.' };
  if (type !== undefined && (typeof type !== 'string' || type.length > 64)) return { status: 400, error: 'El tipo de alerta no es válido.' };

  fs.mkdirSync(uploadsDir, { recursive: true });
  const prefix = type ? `alert-${type.replace(/[^a-z0-9_-]/gi, '') || 'media'}` : 'upload';
  const filename = `${prefix}-${Date.now()}-${require('crypto').randomBytes(4).toString('hex')}${ext}`;
  fs.writeFileSync(path.join(uploadsDir, filename), buffer, { flag: 'wx' });
  return { filename, url: `/uploads/${filename}` };
}

module.exports = { saveUpload };
