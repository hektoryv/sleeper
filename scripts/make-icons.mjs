/**
 * Generates the app icons. Writes PNGs by hand with node:zlib so the project
 * keeps its no-dependencies rule. Run with: node scripts/make-icons.mjs
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');

const BG = [11, 11, 13];
const RING = [201, 138, 168];

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function png(size, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour RGB
  // Each scanline is prefixed with filter type 0 (none).
  const raw = Buffer.alloc(size * (size * 3 + 1));
  let at = 0;
  for (let y = 0; y < size; y++) {
    raw[at++] = 0;
    for (let x = 0; x < size; x++) {
      const p = (y * size + x) * 3;
      raw[at++] = pixels[p];
      raw[at++] = pixels[p + 1];
      raw[at++] = pixels[p + 2];
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** A ring on a dark field - the circled digit from the board. 4x supersampled. */
function draw(size) {
  const pixels = Buffer.alloc(size * size * 3);
  const centre = size / 2;
  const outer = size * 0.3;
  const inner = size * 0.225;
  const samples = 4;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hits = 0;
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const dx = x + (sx + 0.5) / samples - centre;
          const dy = y + (sy + 0.5) / samples - centre;
          const d = Math.hypot(dx, dy);
          if (d <= outer && d >= inner) hits++;
        }
      }
      const a = hits / (samples * samples);
      const p = (y * size + x) * 3;
      for (let c = 0; c < 3; c++) pixels[p + c] = Math.round(BG[c] * (1 - a) + RING[c] * a);
    }
  }
  return pixels;
}

mkdirSync(OUT, { recursive: true });
for (const size of [192, 512]) {
  writeFileSync(join(OUT, `icon-${size}.png`), png(size, draw(size)));
}

writeFileSync(
  join(OUT, 'icon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0b0b0d"/>
  <circle cx="256" cy="256" r="134" fill="none" stroke="#c98aa8" stroke-width="38"/>
</svg>
`,
);

console.log('wrote icons to', OUT);
