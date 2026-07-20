// Tag parsers for non-FLAC media: ID3v2 (mp3) and MP4/iTunes ilst (m4a/mp4/mov).
// Both return the same shape as the FLAC parser: { duration, tags, picture }.
// Everything is defensive — a malformed tag never fails the import, it just
// falls back to filename/folder naming.

const latin1 = new TextDecoder('latin1');
const utf8 = new TextDecoder('utf-8');

/* ───────────────────────── ID3v2 (MP3) ───────────────────────── */

const ID3_TEXT_MAP = {
  TIT2: 'TITLE', TPE1: 'ARTIST', TPE2: 'ALBUMARTIST', TALB: 'ALBUM',
  TRCK: 'TRACKNUMBER', TPOS: 'DISCNUMBER', TYER: 'DATE', TDRC: 'DATE',
  TCON: 'GENRE'
};

function id3Text(bytes) {
  if (!bytes.length) return '';
  const enc = bytes[0];
  const body = bytes.subarray(1);
  try {
    if (enc === 0) return latin1.decode(body).replace(/\0+$/, '').trim();
    if (enc === 3) return utf8.decode(body).replace(/\0+$/, '').trim();
    // 1 = UTF-16 with BOM, 2 = UTF-16BE
    const le = enc === 1 && body[0] === 0xff && body[1] === 0xfe;
    const dec = new TextDecoder(le ? 'utf-16le' : 'utf-16be');
    const start = enc === 1 && (body[0] === 0xff || body[0] === 0xfe) ? 2 : 0;
    return dec.decode(body.subarray(start)).replace(/\0+$/, '').trim();
  } catch {
    return '';
  }
}

export async function parseID3(file) {
  const meta = { duration: 0, tags: {}, picture: null };
  const head = new Uint8Array(await file.slice(0, 10).arrayBuffer());
  if (head.length < 10 || head[0] !== 0x49 || head[1] !== 0x44 || head[2] !== 0x33) return meta; // "ID3"
  const ver = head[3]; // 3 = v2.3, 4 = v2.4
  const size = ((head[6] & 0x7f) << 21) | ((head[7] & 0x7f) << 14) | ((head[8] & 0x7f) << 7) | (head[9] & 0x7f);
  if (size <= 0 || size > 64 * 1024 * 1024) return meta;
  const buf = new Uint8Array(await file.slice(10, 10 + size).arrayBuffer());
  let p = 0;
  try {
    while (p + 10 <= buf.length) {
      const id = latin1.decode(buf.subarray(p, p + 4));
      if (!/^[A-Z0-9]{4}$/.test(id)) break; // padding reached
      const rawSize = ver === 4
        ? ((buf[p + 4] & 0x7f) << 21) | ((buf[p + 5] & 0x7f) << 14) | ((buf[p + 6] & 0x7f) << 7) | (buf[p + 7] & 0x7f)
        : (buf[p + 4] << 24) | (buf[p + 5] << 16) | (buf[p + 6] << 8) | buf[p + 7];
      p += 10;
      if (rawSize <= 0 || p + rawSize > buf.length) break;
      const frame = buf.subarray(p, p + rawSize);
      p += rawSize;
      const key = ID3_TEXT_MAP[id];
      if (key && !(key in meta.tags)) {
        const v = id3Text(frame);
        if (v) meta.tags[key] = v;
      } else if (id === 'APIC' && !meta.picture) {
        // encoding(1) mime(latin1, \0) picType(1) description(\0 per enc) data
        const enc = frame[0];
        let q = 1;
        while (q < frame.length && frame[q] !== 0) q++;
        const mime = latin1.decode(frame.subarray(1, q)) || 'image/jpeg';
        q += 2; // skip null + picture type byte
        if (enc === 1 || enc === 2) {
          while (q + 1 < frame.length && !(frame[q] === 0 && frame[q + 1] === 0)) q += 2;
          q += 2;
        } else {
          while (q < frame.length && frame[q] !== 0) q++;
          q += 1;
        }
        if (q < frame.length) {
          meta.picture = new Blob([frame.subarray(q).slice()], { type: mime.includes('/') ? mime : 'image/' + mime });
        }
      }
    }
  } catch { /* tolerate malformed tags */ }
  return meta;
}

/* ─────────────────── MP4 / M4A (moov.udta.meta.ilst) ─────────────────── */

const MP4_TAG_MAP = {
  '©nam': 'TITLE', '©ART': 'ARTIST', aART: 'ALBUMARTIST', '©alb': 'ALBUM',
  '©day': 'DATE', '©gen': 'GENRE'
};

function walkBoxes(buf, start, end, cb) {
  let p = start;
  while (p + 8 <= end) {
    const size = (buf[p] << 24 | buf[p + 1] << 16 | buf[p + 2] << 8 | buf[p + 3]) >>> 0;
    const type = latin1.decode(buf.subarray(p + 4, p + 8));
    if (size < 8 || p + size > end) break;
    cb(type, p + 8, p + size);
    p += size;
  }
}

export async function parseMP4(file) {
  const meta = { duration: 0, tags: {}, picture: null };
  try {
    // find the moov box among top-level boxes (may be at start or end of file)
    let off = 0;
    let moovStart = -1, moovSize = 0;
    for (let i = 0; i < 64 && off + 16 <= file.size; i++) {
      const h = new Uint8Array(await file.slice(off, off + 16).arrayBuffer());
      let size = (h[0] << 24 | h[1] << 16 | h[2] << 8 | h[3]) >>> 0;
      const type = latin1.decode(h.subarray(4, 8));
      if (size === 1) {
        // 64-bit size
        size = Number((BigInt(h[8]) << 56n) | (BigInt(h[9]) << 48n) | (BigInt(h[10]) << 40n) | (BigInt(h[11]) << 32n) |
          (BigInt(h[12]) << 24n) | (BigInt(h[13]) << 16n) | (BigInt(h[14]) << 8n) | BigInt(h[15]));
      }
      if (size < 8) break;
      if (type === 'moov') { moovStart = off; moovSize = size; break; }
      off += size;
    }
    if (moovStart < 0 || moovSize > 96 * 1024 * 1024) return meta;
    const buf = new Uint8Array(await file.slice(moovStart, moovStart + moovSize).arrayBuffer());
    walkBoxes(buf, 8, buf.length, (type, s, e) => {
      if (type === 'mvhd') {
        const v = buf[s];
        if (v === 0) {
          const timescale = (buf[s + 12] << 24 | buf[s + 13] << 16 | buf[s + 14] << 8 | buf[s + 15]) >>> 0;
          const dur = (buf[s + 16] << 24 | buf[s + 17] << 16 | buf[s + 18] << 8 | buf[s + 19]) >>> 0;
          if (timescale > 0) meta.duration = dur / timescale;
        }
      } else if (type === 'udta') {
        walkBoxes(buf, s, e, (t2, s2, e2) => {
          if (t2 !== 'meta') return;
          walkBoxes(buf, s2 + 4, e2, (t3, s3, e3) => { // +4 skips meta version/flags
            if (t3 !== 'ilst') return;
            walkBoxes(buf, s3, e3, (item, s4, e4) => {
              walkBoxes(buf, s4, e4, (t5, s5, e5) => {
                if (t5 !== 'data' || e5 - s5 < 8) return;
                const flag = (buf[s5] << 24 | buf[s5 + 1] << 16 | buf[s5 + 2] << 8 | buf[s5 + 3]) >>> 0;
                const payload = buf.subarray(s5 + 8, e5);
                const key = MP4_TAG_MAP[item];
                if (key && flag === 1 && !(key in meta.tags)) {
                  const v = utf8.decode(payload).trim();
                  if (v) meta.tags[key] = v;
                } else if (item === 'trkn' && payload.length >= 4) {
                  meta.tags.TRACKNUMBER = String((payload[2] << 8) | payload[3]);
                } else if (item === 'disk' && payload.length >= 4) {
                  meta.tags.DISCNUMBER = String((payload[2] << 8) | payload[3]);
                } else if (item === 'covr' && !meta.picture) {
                  meta.picture = new Blob([payload.slice()], { type: flag === 14 ? 'image/png' : 'image/jpeg' });
                }
              });
            });
          });
        });
      }
    });
  } catch { /* tolerate malformed files */ }
  return meta;
}

/* ───────────────────────── dispatcher ───────────────────────── */

export async function parseMediaTags(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.mp3')) return parseID3(file);
  if (/\.(m4a|mp4|m4v|mov)$/.test(name)) return parseMP4(file);
  return { duration: 0, tags: {}, picture: null }; // ogg/opus/wav/aac/webm → filename fallback
}
