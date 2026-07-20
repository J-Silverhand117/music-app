// Zero-dependency PNG icon generator — Nothing-style dot-matrix glyph.
// Run: node scripts/gen-icons.mjs  (writes to public/icons/)
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(OUT, { recursive: true });

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function encodePNG(size, rgba) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) rgba.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function drawIcon(size, scale = 1) {
  const px = Buffer.alloc(size * size * 4);
  for (let i = 3; i < px.length; i += 4) px[i] = 255; // opaque black
  const c = size / 2;
  const dots = [];
  // outer dot ring (record / speaker glyph)
  const N = 22, R = size * 0.31 * scale, r = size * 0.027 * scale;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 - Math.PI / 2;
    dots.push({ x: c + R * Math.cos(a), y: c + R * Math.sin(a), r, col: [235, 235, 235] });
  }
  // dim inner ring
  const N2 = 11, R2 = size * 0.185 * scale;
  for (let i = 0; i < N2; i++) {
    const a = (i / N2) * Math.PI * 2 - Math.PI / 2 + Math.PI / N2;
    dots.push({ x: c + R2 * Math.cos(a), y: c + R2 * Math.sin(a), r: r * 0.8, col: [92, 92, 92] });
  }
  // red center dot
  dots.push({ x: c, y: c, r: size * 0.06 * scale, col: [215, 25, 33] });

  for (const d of dots) {
    const x0 = Math.max(0, Math.floor(d.x - d.r - 2));
    const x1 = Math.min(size - 1, Math.ceil(d.x + d.r + 2));
    const y0 = Math.max(0, Math.floor(d.y - d.r - 2));
    const y1 = Math.min(size - 1, Math.ceil(d.y + d.r + 2));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dist = Math.hypot(x + 0.5 - d.x, y + 0.5 - d.y);
        const cov = Math.min(1, Math.max(0, d.r - dist + 0.75));
        if (cov <= 0) continue;
        const p = (y * size + x) * 4;
        px[p] = px[p] * (1 - cov) + d.col[0] * cov;
        px[p + 1] = px[p + 1] * (1 - cov) + d.col[1] * cov;
        px[p + 2] = px[p + 2] * (1 - cov) + d.col[2] * cov;
      }
    }
  }
  return px;
}

for (const [name, size, scale] of [
  ['icon-512.png', 512, 1],
  ['icon-192.png', 192, 1],
  ['icon-180.png', 180, 1],
  ['maskable-512.png', 512, 0.78]
]) {
  writeFileSync(join(OUT, name), encodePNG(size, drawIcon(size, scale)));
  console.log('wrote', name);
}
