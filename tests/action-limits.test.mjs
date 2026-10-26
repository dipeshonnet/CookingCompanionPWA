import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_RECIPE_ACTIONS, RecipeActionLimitError, scaleRecipeForPortions } from '../modules/recipe-portions.js';
import { normalizeRecipeForStorage, validateRecipeSteps } from '../modules/recipe-domain.js';
import { buildRecipeSchedule } from '../modules/play-engine.js';
import { recipeForImport } from '../modules/recipe-personalization.js';
import { handleRecipeImport } from '../modules/recipe-transfer.js';
import { STATE } from '../modules/state.js';

const batchRecipe = counts => ({
  id: 'batch-budget', title: 'Batch budget', servings: 1, ingredients: [],
  steps: counts.map((count, index) => ({
    action: 'Stir sauce.',
    scaling: { mode: 'batch', group: `pan-${index}`, yield: count, capacity: 1, secondsPerBatch: 1 }
  }))
});

test('batch expansion enforces one aggregate budget before making copies', () => {
  for (const counts of [[1001, 1001], Array(250).fill(251), [2001]]) {
    const recipe = recipeForImport(batchRecipe(counts));
    const before = JSON.stringify(recipe);
    assert.throws(() => scaleRecipeForPortions(recipe, 1), RecipeActionLimitError);
    assert.equal(JSON.stringify(recipe), before);
  }
  const overflow = batchRecipe([Number.MAX_VALUE]);
  overflow.steps[0].scaling.capacity = Number.MIN_VALUE;
  assert.throws(() => scaleRecipeForPortions(recipeForImport(overflow)), RecipeActionLimitError);
});

test('exactly 2000 expanded actions remain playable with complete dependencies', () => {
  assert.equal(MAX_RECIPE_ACTIONS, 2000);
  const recipe = recipeForImport(batchRecipe([1000, 1000]));
  const scaled = scaleRecipeForPortions(recipe, 1);
  assert.equal(scaled.steps.length, MAX_RECIPE_ACTIONS);
  validateRecipeSteps(scaled.steps);
  const schedule = buildRecipeSchedule(scaled);
  assert.equal(schedule.steps.length, MAX_RECIPE_ACTIONS);
  assert.equal(schedule.duration, MAX_RECIPE_ACTIONS);
  assert.equal(scaleRecipeForPortions(scaled, 1).steps.length, MAX_RECIPE_ACTIONS);
});

test('2000 source actions and a full dependency chain survive normalization and projection', () => {
  const recipe = {
    id: 'long-chain', title: 'Long chain', stepSchemaVersion: 2,
    steps: Array.from({ length: MAX_RECIPE_ACTIONS }, (_, index) => ({
      id: `action-${index}`, title: 'Stir sauce', action: 'Stir sauce.', duration: 1,
      attention: 'active', dependsOn: index ? [`action-${index - 1}`] : []
    }))
  };
  const normalized = normalizeRecipeForStorage(recipe);
  assert.equal(normalized.steps.length, MAX_RECIPE_ACTIONS);
  const schedule = buildRecipeSchedule(normalized);
  assert.equal(schedule.steps.length, MAX_RECIPE_ACTIONS);
  assert.equal(schedule.steps.at(-1).end, MAX_RECIPE_ACTIONS);
  recipe.steps.push({ ...recipe.steps.at(-1), id: 'too-many' });
  assert.throws(() => normalizeRecipeForStorage(recipe), RecipeActionLimitError);
  assert.throws(() => normalizeRecipeForStorage({ ...recipe, stepSchemaVersion: 1 }), RecipeActionLimitError);
});

test('hostile imports fail atomically without changing recipes or device storage', async t => {
  const previous = STATE.customRecipes;
  const existing = [{ id: 'existing', title: 'Existing', ingredients: [], steps: [] }];
  STATE.customRecipes = existing;
  t.after(() => { STATE.customRecipes = previous; });
  const messages = [], writes = [];
  t.mock.method(console, 'error', () => {});
  const globals = { alert: globalThis.alert, localStorage: globalThis.localStorage };
  t.after(() => { Object.assign(globalThis, globals); });
  globalThis.alert = message => messages.push(message);
  globalThis.localStorage = { setItem: (...args) => writes.push(args), getItem: () => null, removeItem: (...args) => writes.push(args) };
  for (const counts of [[2001], [1001, 1001]]) {
    const text = JSON.stringify({ recipes: [{ id: 'ordinary', title: 'Ordinary', ingredients: [], steps: [] }, batchRecipe(counts)] });
    const target = { value: 'recipe.json', files: [{ size: Buffer.byteLength(text), text: async () => text }] };
    await handleRecipeImport({ target });
    assert.equal(STATE.customRecipes, existing);
    assert.deepEqual(writes, []);
    assert.match(messages.at(-1), /Import failed.*2,000 cooking actions/);
    assert.equal(target.value, '');
  }
});
