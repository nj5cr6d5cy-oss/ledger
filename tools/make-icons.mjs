// Generates the PNG app icons (iOS needs PNG for apple-touch-icon). Run: npm run icons
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x, y);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
// Shapes in a 512 unit space (full-bleed background; iOS rounds corners itself)
const bars = [[100, 272, 80, 120], [216, 202, 80, 190], [332, 132, 80, 260]];
function inRound(px, py, [x, y, w, h], r = 20) {
  if (px < x || px > x + w || py < y || py > y + h) return false;
  const cx = Math.min(Math.max(px, x + r), x + w - r), cy = Math.min(Math.max(py, y + r), y + h - r);
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
}
const top = [0x14, 0xb8, 0xa6], bot = [0x0f, 0x5f, 0x58];
function render(size) {
  const s = 512 / size, SS = 4;
  return png(size, (x, y) => {
    const t = y / size;
    const bg = top.map((c, i) => c + (bot[i] - c) * t);
    let cover = 0;
    for (let i = 0; i < SS; i++) for (let j = 0; j < SS; j++) {
      const px = (x + (i + 0.5) / SS) * s, py = (y + (j + 0.5) / SS) * s;
      if (bars.some((b) => inRound(px, py, b))) cover++;
    }
    const a = cover / (SS * SS);
    return bg.map((c) => Math.round(c * (1 - a) + 255 * a));
  });
}
for (const size of [180, 192, 512]) writeFileSync(new URL(`../icons/icon-${size}.png`, import.meta.url), render(size));
console.log('icons written');
