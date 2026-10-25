import test from 'node:test';
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { ACTION_TYPES, actionVideoSource, actionVideoHtml, inferActionType } from '../modules/action-types.js';
import { normalizeStep, normalizeRecipeForStorage } from '../modules/recipe-domain.js';

test('every requested cooking action has a bundled video; Other has none', async () => {
  assert.equal(ACTION_TYPES.length, 22);
  assert.equal(new Set(ACTION_TYPES.map(actionVideoSource)).size, 22);
  for (const type of ACTION_TYPES) {
    assert.ok((await stat(actionVideoSource(type))).size > 1000);
    assert.match(actionVideoHtml(type), /autoplay loop muted playsinline controls/);
  }
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
