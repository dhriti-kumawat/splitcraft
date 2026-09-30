// Builds the extension into dist/ and zips it as dist/splitcraft-preview.zip, which the
// marketing site serves at /extension/splitcraft-preview.zip (load it unpacked).
import { build } from 'esbuild';
import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { deflateRawSync } from 'node:zlib';

const out = new URL('../dist/', import.meta.url);
const unpacked = new URL('./unpacked/', out);
rmSync(out, { recursive: true, force: true });
mkdirSync(unpacked, { recursive: true });

await build({
  entryPoints: ['background', 'dashboard-bridge', 'preview-bridge', 'popup'].map(
    (n) => new URL(`../src/${n}.ts`, import.meta.url).pathname,
  ),
  outdir: unpacked.pathname,
  bundle: true,
  format: 'iife',
  target: 'chrome120',
  minify: false,
});
for (const f of readdirSync(new URL('../static/', import.meta.url)))
  copyFileSync(new URL(`../static/${f}`, import.meta.url), new URL(f, unpacked));
// The preview itself is the SDK's preview bundle: build packages/sdk first.
copyFileSync(
  new URL('../../../packages/sdk/dist/splitcraft-preview.iife.js', import.meta.url),
  new URL('splitcraft-preview.iife.js', unpacked),
);

writeFileSync(new URL('splitcraft-preview.zip', out), zip(unpacked));
console.log('Built apps/extension/dist/unpacked and dist/splitcraft-preview.zip');

/** A minimal zip (deflate) of the files in `dir`, inside a splitcraft-preview/ folder. */
function zip(dir) {
  const files = readdirSync(dir)
    .filter((f) => statSync(new URL(f, dir)).isFile())
    .sort();
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const f of files) {
    const data = readFileSync(new URL(f, dir));
    const packed = deflateRawSync(data);
    const name = Buffer.from(`splitcraft-preview/${f}`);
    const crc = crc32(data);
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0);
    head.writeUInt16LE(20, 4);
    head.writeUInt16LE(8, 8);
    head.writeUInt32LE(crc, 14);
    head.writeUInt32LE(packed.length, 18);
    head.writeUInt32LE(data.length, 22);
    head.writeUInt16LE(name.length, 26);
    locals.push(head, name, packed);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(8, 10);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(packed.length, 20);
    c.writeUInt32LE(data.length, 24);
    c.writeUInt16LE(name.length, 28);
    c.writeUInt32LE(offset, 42);
    centrals.push(c, name);
    offset += head.length + name.length + packed.length;
  }
  const central = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, central, end]);
}

function crc32(buf) {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
