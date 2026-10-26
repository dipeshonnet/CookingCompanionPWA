import test from 'node:test';
import assert from 'node:assert/strict';
import { stat, readFile } from 'node:fs/promises';
import { ACTION_TYPES, actionVideoSource, actionVideoHtml, inferActionType } from '../modules/action-types.js';
import { normalizeStep, normalizeRecipeForStorage } from '../modules/recipe-domain.js';

test('every requested cooking action has a bundled GIF; Other has none', async () => {
  assert.equal(ACTION_TYPES.length, 38);
  assert.equal(new Set(ACTION_TYPES.map(actionVideoSource)).size, 38);
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
  assert.ok(totalBytes <= 750000, 'expanded GIF set stays within 750 KB');
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


test('common preparation and cooking verbs select the first action without matching ingredient substrings', () => {
  const examples = {
    'Rinse rice before boiling': 'Rinse',
    'Rinsing lentils under running water': 'Rinse',
    'Wash spinach': 'Wash', 'Soak chickpeas': 'Soak', 'Measure flour': 'Measure',
    'Crush garlic': 'Crush', 'Sift flour': 'Sift', 'Roll dough': 'Roll',
    'Fold the batter': 'Fold', 'Toss the salad': 'Toss', 'Marinate paneer': 'Marinate',
    'Heat the pan': 'Heat', 'Toast bread': 'Toast', 'Flip the pancake': 'Flip',
    'Cover the pot': 'Cover', 'Rest the dough': 'Rest', 'Cool the sauce': 'Cool',
    'Saut\u00e9 onions': 'Saut\u00e9', 'Slice tomatoes before rinsing': 'Slice',
    'Restock the cupboard': 'Other'
  };
  for (const [instruction, expected] of Object.entries(examples)) assert.equal(inferActionType(instruction), expected, instruction);
});
