import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require(process.env.SHARP_MODULE_PATH || 'sharp');
let sources = {};
try { sources = JSON.parse(await readFile('docs/recipe-photo-sources.json', 'utf8')); } catch {}
let candidates = Object.fromEntries(Object.entries(sources).map(([id, photo]) => [id, { title: photo.title, candidates: [photo] }]));
try { candidates = JSON.parse(await readFile('output/recipe-photos/candidates.json', 'utf8')); } catch {}
try { Object.assign(candidates, JSON.parse(await readFile('output/recipe-photos/overrides.json', 'utf8'))); } catch {}
const generated = JSON.parse(await readFile('docs/generated-recipe-photos.json', 'utf8'));
for (const [id, photo] of Object.entries(generated)) {
  sources[id] = { ...photo, kind: 'generated', source: 'AI-generated', author: 'OpenAI image generation', modifications: 'Resized and converted to WebP; display cropped to fit.' };
  delete candidates[id];
}
let selections = {};
try { selections = JSON.parse(await readFile('output/recipe-photos/selections.json', 'utf8')); } catch {}
await mkdir('assets/recipes', { recursive: true });
for (const [id, recipe] of Object.entries(candidates)) {
  const selected = recipe.candidates[selections[id] ?? 0];
  if (!selected) continue;
  const image = `assets/recipes/${id.replace(/^veg-/, '')}.webp`;
  if (sources[id]?.source === selected.source) {
    try { await access(image); continue; } catch {}
  }
  try {
    const response = await fetch(selected.url, { signal: AbortSignal.timeout(45000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    await sharp(buffer).rotate().resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true }).webp({ quality: 78 }).toFile(image);
    sources[id] = { title: recipe.title, image, ...selected, modifications: 'Resized and converted to WebP; display cropped to fit.' };
    console.log(`Saved ${recipe.title}`);
  } catch (error) { console.error(`${recipe.title}: ${error.message}`); }
}
await writeFile('docs/recipe-photo-sources.json', JSON.stringify(sources, null, 2) + '\n');
const photos = Object.fromEntries(Object.values(sources).map(photo => [photo.title, {
  image: photo.image,
  imageCredit: photo.kind === 'generated'
    ? `AI-generated illustration of ${photo.title}, created with OpenAI image generation. ${photo.modifications}`
    : `${photo.file.replace(/^File:/, '')} by ${photo.author}, ${photo.license} (${photo.licenseUrl}). Source: ${photo.source}. ${photo.modifications}`
}]));
await writeFile('modules/recipe-photos.js', '// Recipe photographs and AI-generated illustrations. Provenance: docs/recipe-photo-sources.json.\nexport const RECIPE_PHOTOS = ' + JSON.stringify(photos, null, 2) + ';\n');
await writeFile('assets/recipes/ATTRIBUTION.LICENSE', 'Recipe images\nCommons photographs remain under their individual licenses. AI-generated illustrations are identified separately.\n\n' + Object.values(sources).map(photo => `${photo.title} (${photo.image})\n${photos[photo.title].imageCredit}\n`).join('\n'));
console.log(`${Object.keys(sources).length} recipe images packaged.`);
