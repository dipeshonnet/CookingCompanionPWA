import { COMMON_INGREDIENTS } from '../modules/ingredient-catalogue.js';
import { ingredientImageSource } from '../modules/ingredient-images.js';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require(process.env.SHARP_MODULE_PATH || 'sharp');
const names = Object.values(COMMON_INGREDIENTS).flat();
const columns = 12;
const cells = await Promise.all(names.map(async (name, index) => {
  const photo = await sharp(ingredientImageSource(name).slice(1)).resize(104, 104).png().toBuffer();
  const lines = name.length > 21 ? name.replace(/(.{1,21})\s/, '$1|').split('|') : [name];
  const label = Buffer.from(`<svg width="132" height="40"><rect width="132" height="40" fill="white"/>${lines.map((line, i) => `<text x="66" y="${14 + i * 14}" text-anchor="middle" fill="#111" font-family="Arial" font-size="10">${line}</text>`).join('')}</svg>`);
  const top = Math.floor(index / columns) * 148;
  const left = index % columns * 132;
  return [{ input: photo, left: left + 14, top }, { input: label, left, top: top + 104 }];
}));
await sharp({ create: { width: columns * 132, height: Math.ceil(names.length / columns) * 148, channels: 3, background: '#fff' } }).composite(cells.flat()).png().toFile('output/ingredient-photos/contact-sheet.png');
