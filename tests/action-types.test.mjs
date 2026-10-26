import test from 'node:test';
import assert from 'node:assert/strict';
import { stat, readFile } from 'node:fs/promises';
import { ACTION_TYPES, actionVideoSource, actionVideoHtml, inferActionType } from '../modules/action-types.js';
import { normalizeStep, normalizeRecipeForStorage } from '../modules/recipe-domain.js';

test('every requested cooking action has a bundled GIF; Other has none', async () => {
  assert.equal(ACTION_TYPES.length, 22);
  assert.equal(new Set(ACTION_TYPES.map(actionVideoSource)).size, 22);
  let totalBytes = 0;
  for (const type of ACTION_TYPES) {
    const source = actionVideoSource(type);
    assert.match(source, /\.gif$/);
    const bytes = await readFile(source);
    totalBytes += (await stat(source)).size;
    assert.equal(bytes.subarray(0, 6).toString(), 'GIF89a');
    assert.ok(bytes.includes(Buffer.from('NETSCAPE2.0')), 'GIF loops');
    assert.match(actionVideoHtml(type), /<img .*loading="lazy"/);
    assert.doesNotMatch(actionVideoHtml(type), /<video/);
  }
  assert.ok(totalBytes <= 498246, 'GIF set stays within the previous video size');
  assert.equal(actionVideoHtml('Other'), '');
  assert.equal(actionVideoHtml('<script>'), '');
});
test('action selections survive storage normalization and explicit Other overrides inference', () => {
  for (const actionType of [...ACTION_TYPES, 'Other']) {
    const recipe = normalizeRecipeForStorage({ title: 'Demo', steps: [{action: 'Chop onion', actionType}] });
    assert.equal(normalizeRecipeForStorage(JSON.parse(JSON.stringify(recipe))).steps[0].actionType, actionType);
  }
  assert.equal(normalizeStep({ action: 'Slice tomatoes' }, 0).actionType, 'Slice');
  assert.equal(inferActionType('Saute the onions'), 'Sauté');
  assert.equal(inferActionType('Roast potatoes'), 'Bake / Roast');
  assert.equal(normalizeStep({ action: 'Chop onion', actionType: 'invalid' }, 0).actionType, 'Other');
});
