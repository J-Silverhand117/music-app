// Minimal FLAC metadata parser — reads STREAMINFO, VORBIS_COMMENT and PICTURE
// blocks directly from the file via slices (never loads the whole file into memory).

const dec = new TextDecoder();

export async function parseFlac(file) {
  const sig = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (sig.length < 4 || sig[0] !== 0x66 || sig[1] !== 0x4c || sig[2] !== 0x61 || sig[3] !== 0x43) {
    throw new Error('not a FLAC file');
  }
  const meta = { duration: 0, sampleRate: 0, bps: 0, channels: 0, tags: {}, picture: null };
  let off = 4;
  let picType = -1;
  for (let i = 0; i < 128; i++) {
    const h = new Uint8Array(await file.slice(off, off + 4).arrayBuffer());
    if (h.length < 4) break;
    const last = (h[0] & 0x80) !== 0;
    const type = h[0] & 0x7f;
    const len = (h[1] << 16) | (h[2] << 8) | h[3];
    try {
      if (type === 0 && len >= 34) {
        readStreamInfo(new DataView(await file.slice(off + 4, off + 4 + len).arrayBuffer()), meta);
      } else if (type === 4) {
        readVorbisComment(new DataView(await file.slice(off + 4, off + 4 + len).arrayBuffer()), meta);
      } else if (type === 6) {
        const pic = readPicture(new DataView(await file.slice(off + 4, off + 4 + len).arrayBuffer()));
        // prefer picture type 3 (front cover)
        if (pic && (!meta.picture || (pic.type === 3 && picType !== 3))) {
          meta.picture = pic.blob;
          picType = pic.type;
        }
      }
    } catch {
      // malformed block — skip it, keep whatever we parsed so far
    }
    off += 4 + len;
    if (last) break;
  }
  return meta;
}

function readStreamInfo(dv, meta) {
  const b = n => dv.getUint8(n);
  meta.sampleRate = (b(10) << 12) | (b(11) << 4) | (b(12) >> 4);
  meta.channels = ((b(12) >> 1) & 0x07) + 1;
  meta.bps = (((b(12) & 1) << 4) | (b(13) >> 4)) + 1; // bits per sample (16/24/32)
  const totalSamples = (b(13) & 0x0f) * 4294967296 + dv.getUint32(14);
  if (meta.sampleRate > 0) meta.duration = totalSamples / meta.sampleRate;
}

function readVorbisComment(dv, meta) {
  let p = 0;
  const vendorLen = dv.getUint32(p, true);
  p += 4 + vendorLen;
  const count = dv.getUint32(p, true);
  p += 4;
  for (let i = 0; i < count && p + 4 <= dv.byteLength; i++) {
    const len = dv.getUint32(p, true);
    p += 4;
    if (p + len > dv.byteLength) break;
    const s = dec.decode(new Uint8Array(dv.buffer, dv.byteOffset + p, len));
    p += len;
    const eq = s.indexOf('=');
    if (eq <= 0) continue;
    const key = s.slice(0, eq).toUpperCase();
    const val = s.slice(eq + 1).trim();
    if (val && !(key in meta.tags)) meta.tags[key] = val;
  }
}

function readPicture(dv) {
  let p = 0;
  const type = dv.getUint32(p); p += 4;
  const mimeLen = dv.getUint32(p); p += 4;
  const mime = dec.decode(new Uint8Array(dv.buffer, dv.byteOffset + p, mimeLen)); p += mimeLen;
  const descLen = dv.getUint32(p); p += 4 + descLen;
  p += 16; // width, height, depth, colors
  const dataLen = dv.getUint32(p); p += 4;
  if (p + dataLen > dv.byteLength) return null;
  const data = new Uint8Array(dv.buffer, dv.byteOffset + p, dataLen).slice();
  return { type, blob: new Blob([data], { type: mime || 'image/jpeg' }) };
}

const intOf = v => {
  const n = parseInt(String(v ?? '').split('/')[0], 10);
  return Number.isFinite(n) ? n : 0;
};

// Derives artist/album fallbacks from the imported folder structure, e.g.
//   "Artist/Album/01 Track.flac"                         -> artist, album
//   "Artist/Singles & EPs/Some EP/01 Track.flac"          -> artist, "Some EP"
//   "Artist/01 Track.flac"                                -> artist only
// The immediate parent folder is always treated as the album/EP/single name,
// no matter how many "category" folders sit between the artist and it.
function folderFallback(relPath) {
  const parts = relPath.split('/').filter(Boolean);
  parts.pop(); // drop the filename
  if (!parts.length) return { artist: null, album: null };
  return {
    artist: parts[0],
    album: parts.length > 1 ? parts[parts.length - 1] : null
  };
}

export function trackFromMeta(file, meta, relPath = '') {
  const t = meta.tags;
  const fb = folderFallback(relPath || file.webkitRelativePath || file.name);
  const artist = t.ARTIST || t.ALBUMARTIST || fb.artist || 'Unknown Artist';
  const albumArtist = t.ALBUMARTIST || (t.ARTIST ? artist : fb.artist || artist);
  const album = t.ALBUM || fb.album || 'Unknown Album';
  return {
    id: crypto.randomUUID(),
    title: t.TITLE || file.name.replace(/\.flac$/i, ''),
    artist,
    albumArtist,
    album,
    albumKey: `${albumArtist}::${album}`.toLowerCase(),
    trackNo: intOf(t.TRACKNUMBER || t.TRACK),
    discNo: intOf(t.DISCNUMBER) || 1,
    year: (t.DATE || t.YEAR || t.ORIGINALDATE || '').slice(0, 4),
    genre: t.GENRE || '',
    duration: meta.duration,
    sampleRate: meta.sampleRate,
    bps: meta.bps || 0,
    channels: meta.channels || 0,
    fileName: file.name,
    filePath: relPath || file.name,
    size: file.size,
    addedAt: Date.now()
  };
}
