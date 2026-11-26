import fs from 'node:fs';

// The Windows icon contains the approved Brick by Script handstyle mark,
// rendered at multiple resolutions. Use the largest PNG frame in Electron.
const icon = fs.readFileSync(new URL('../build/icon.ico', import.meta.url));
const count = icon.readUInt16LE(4);
const frames = Array.from({length: count}, (_, index) => {
  const entry = 6 + index * 16;
  return {
    width: icon[entry] || 256,
    length: icon.readUInt32LE(entry + 8),
    offset: icon.readUInt32LE(entry + 12),
  };
});
const largest = frames.sort((a, b) => b.width - a.width)[0];
const png = icon.subarray(largest.offset, largest.offset + largest.length);
if (png.readUInt32BE(0) !== 0x89504e47) throw new Error('The brand icon needs a PNG frame.');
fs.writeFileSync(new URL('../build/icon.png', import.meta.url), png);
fs.copyFileSync(new URL('../build/icon.ico', import.meta.url), new URL('../public/favicon.ico', import.meta.url));
