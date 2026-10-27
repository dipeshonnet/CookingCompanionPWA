import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { APP_RECIPES } from '../recipes.js';
import { clientFiles } from '../tools/client-files.mjs';

test('every collection recipe has a packaged, credited photograph available offline', async () => {
  const bundled = new Set(await clientFiles());
  const sources = JSON.parse(await readFile(new URL('../docs/recipe-photo-sources.json', import.meta.url), 'utf8'));
  for (const recipe of APP_RECIPES.filter(recipe => recipe.id.startsWith('veg-'))) {
    assert.match(recipe.image, /^assets\/recipes\/.+\.(webp|jpg)$/, recipe.title);
    assert.ok(bundled.has(recipe.image), `${recipe.title} is bundled offline`);
    assert.ok(recipe.imageCredit, `${recipe.title} has attribution`);
    if (recipe.id === 'veg-idli') continue;
    const source = sources[recipe.id];
    assert.equal(source.image, recipe.image);
    if (source.kind === 'generated') {
      assert.match(recipe.imageCredit, /AI-generated/);
      assert.ok(source.prompt, `${recipe.title} retains its generation prompt`);
    } else {
      assert.match(source.source, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      assert.match(source.license, /^(CC BY(?:-SA)? [\d.]+|CC0(?: 1.0)?|Public domain)$/i);
      assert.ok(source.author, `${recipe.title} identifies its photographer`);
      assert.ok(recipe.imageCredit.includes(source.author));
    }
    const data = await readFile(new URL(`../${recipe.image}`, import.meta.url));
    assert.equal(data.toString('ascii', 0, 4), 'RIFF', recipe.title);
    assert.equal(data.toString('ascii', 8, 12), 'WEBP', recipe.title);
    assert.ok(data.length > 2000, `${recipe.title} contains actual image data`);
  }
  assert.ok(bundled.has('assets/recipes/ATTRIBUTION.LICENSE'));
});
