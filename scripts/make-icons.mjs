// Draws the Splitcraft logo (design/tokens: a green rounded square with a white and an
// orange bar) as PNGs for places SVG icons don't reach: Safari tabs, home-screen icons and
// the Chrome extension. Run `node scripts/make-icons.mjs` after changing the logo.
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

// The logo in its 26 × 26 viewBox (apps/web/public/favicon.svg).
const SHAPES = [
  { x: 1, y: 1, w: 24, h: 24, r: 6, rgb: [0x0f, 0x6b, 0x57] },
  { x: 6.5, y: 7, w: 5.5, h: 12, r: 1.5, rgb: [0xff, 0xff, 0xff] },
  { x: 14, y: 7, w: 5.5, h: 12, r: 1.5, rgb: [0xf2, 0xb3, 0x7a] },
];

/** Is (px, py) inside the rounded rectangle? */
function inside(s, px, py) {
  const cx = Math.min(Math.max(px, s.x + s.r), s.x + s.w - s.r);
  const cy = Math.min(Math.max(py, s.y + s.r), s.y + s.h - s.r);
  if (px < s.x || px > s.x + s.w || py < s.y || py > s.y + s.h) return false;
  return (px - cx) ** 2 + (py - cy) ** 2 <= s.r ** 2;
}

/**
 * RGBA pixels of the logo at `size` px, 4 × 4 supersampled. `pad` is extra margin in
 * viewBox units; `bleed` fills the background with the logo green (home-screen icons).
 */
function draw(size, pad = 0, bleed = false) {
  const view = 26 + pad * 2;
  const px = Buffer.alloc(size * size * 4);
  const N = 4;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      for (let sy = 0; sy < N; sy++) {
        for (let sx = 0; sx < N; sx++) {
          const vx = ((x + (sx + 0.5) / N) / size) * view - pad;
          const vy = ((y + (sy + 0.5) / N) / size) * view - pad;
          const hit =
            [...SHAPES].reverse().find((s) => inside(s, vx, vy)) ?? (bleed ? SHAPES[0] : undefined);
          if (!hit) continue;
          r += hit.rgb[0];
          g += hit.rgb[1];
          b += hit.rgb[2];
          a += 1;
        }
      }
      const i = (y * size + x) * 4;
      if (a) {
        px[i] = Math.round(r / a);
        px[i + 1] = Math.round(g / a);
        px[i + 2] = Math.round(b / a);
        px[i + 3] = Math.round((a / (N * N)) * 255);
      }
    }
  }
  return px;
}

function png(size, rgba) {
  const rows = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++)
    rgba.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function crc32(buf) {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

const root = new URL('../', import.meta.url);
const write = (path, size, pad, bleed) => {
  const url = new URL(path, root);
  mkdirSync(new URL('./', url), { recursive: true });
  writeFileSync(url, png(size, draw(size, pad, bleed)));
  console.log(`${path} (${size} px)`);
};

for (const app of ['apps/web/public', 'apps/dashboard/public']) {
  write(`${app}/favicon-32.png`, 32);
  // Home-screen icons are square and full-bleed; iOS rounds the corners itself.
  write(`${app}/apple-touch-icon.png`, 180, 2, true);
}
for (const size of [16, 32, 48, 128]) write(`apps/extension/static/icons/icon-${size}.png`, size);
