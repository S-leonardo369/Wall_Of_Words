/**
 * Creates minimal 1x1 placeholder PNGs for default wallpapers.
 * The wallpaperManager falls back to a pure CSS gradient when no image is found,
 * so these just ensure the directory has entries for testing.
 *
 * For real wallpapers, drop any JPG/PNG into assets/wallpapers/.
 */
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'assets', 'wallpapers');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

// Minimal valid PNG: 1x1 pixel with different colors
function makePNG1x1(r, g, b) {
  const { deflateRawSync } = require('zlib');
  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0); // width
  ihdr.writeUInt32BE(1, 4); // height
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // IDAT — single row: filter byte + RGB
  const raw = Buffer.from([0, r, g, b]);
  const compressed = deflateRawSync(raw);

  function chunk(type, data) {
    const buf = Buffer.alloc(4 + 4 + data.length + 4);
    buf.writeUInt32BE(data.length, 0);
    buf.write(type, 4, 'ascii');
    data.copy(buf, 8);
    const crc = crc32(Buffer.concat([Buffer.from(type), data]));
    buf.writeInt32BE(crc, 8 + data.length);
    return buf;
  }

  function crc32(buf) {
    const table = [];
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      table[i] = c;
    }
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) | 0;
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))]);
}

const wallpapers = [
  { name: 'cosmic.png', r: 15, g: 12, b: 41 },
  { name: 'forest.png', r: 15, g: 32, b: 39 },
  { name: 'aurora.png', r: 26, g: 26, b: 46 }
];

for (const wp of wallpapers) {
  const dest = path.join(OUT, wp.name);
  if (!fs.existsSync(dest)) {
    fs.writeFileSync(dest, makePNG1x1(wp.r, wp.g, wp.b));
    console.log(`[gen-wallpapers] Created placeholder ${wp.name}`);
  }
}
console.log('[gen-wallpapers] Done. Drop real images into assets/wallpapers/ for better results.');
