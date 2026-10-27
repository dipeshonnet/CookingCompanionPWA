import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require(process.env.SHARP_MODULE_PATH || 'sharp');
const sources = Object.values(JSON.parse(await readFile('docs/recipe-photo-sources.json', 'utf8')));
const columns = 6;
await mkdir('output/recipe-photos', { recursive: true });
for (let offset = 0; offset < sources.length; offset += 36) {
  const page = sources.slice(offset, offset + 36);
  const layers = [];
  for (const [index, photo] of page.entries()) {
    const x = index % columns * 180;
    const y = Math.floor(index / columns) * 158;
    const image = await sharp(photo.image).resize(176, 124, { fit: 'contain', background: '#ffffff' }).toBuffer();
    const title = photo.title.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
    const label = Buffer.from(`<svg width="180" height="30"><rect width="180" height="30" fill="white"/><text x="90" y="17" text-anchor="middle" font-family="Arial" font-size="10">${title}</text></svg>`);
    layers.push({ input: image, left: x + 2, top: y }, { input: label, left: x, top: y + 124 });
  }
  await sharp({ create: { width: columns * 180, height: Math.ceil(page.length / columns) * 158, channels: 3, background: '#fff' } }).composite(layers).png().toFile(`output/recipe-photos/contact-sheet-${1 + offset / 36}.png`);
}
