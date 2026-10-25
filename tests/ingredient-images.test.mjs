import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { COMMON_INGREDIENTS } from '../modules/ingredient-catalogue.js';
import { ingredientImageSource, ingredientLabel } from '../modules/ingredient-images.js';
import { HANDPICKED_RECIPES } from '../recipes.js';
import { clientFiles } from '../tools/client-files.mjs';

test('all 156 catalogue ingredients ship with real offline WebP photos and provenance', async () => {
  const ingredients = Object.values(COMMON_INGREDIENTS).flat();
  const sources = JSON.parse(await readFile('docs/ingredient-image-sources.json', 'utf8'));
  const deployed = new Set(await clientFiles());
  assert.equal(ingredients.length, 156);
  for (const name of ingredients) {
    const file = ingredientImageSource(name).slice(1);
    assert.ok(deployed.has(file), `${name} is included in the offline build`);
    assert.equal(sources[name].file, file);
    const bytes = await readFile(file);
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF', name);
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP', name);
    assert.ok(bytes.length > 200, `${name} contains photo data`);
  }
});

test('recipe names, plurals and common Indian aliases use the corresponding ingredient photo', () => {
  for (const item of HANDPICKED_RECIPES.flatMap(recipe => recipe.ingredients)) assert.ok(ingredientImageSource(item.name), item.name);
  for (const [name, canonical] of [['Tomatoes', 'Tomato'], ['Potatoes', 'Potato'], ['aubergine', 'Brinjal'], ['hing', 'Asafoetida'], ['rajma', 'Rajma'], ['atta', 'Whole wheat flour'], ['rice flakes', 'Poha']]) {
    assert.equal(ingredientImageSource(name), ingredientImageSource(canonical));
  }
});

test('custom names remain safe and get a neutral placeholder without external image requests', () => {
  const name = '<img src=x onerror="alert(1)">';
  assert.equal(ingredientImageSource(name), '');
  assert.equal(ingredientLabel(name).includes('<img'), false);
  assert.ok(ingredientLabel(name).includes('&lt;img'));
  assert.ok(ingredientLabel('Tomato').includes('alt=""'));
});
