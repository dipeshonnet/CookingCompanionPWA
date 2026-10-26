import test from 'node:test';
import assert from 'node:assert/strict';
import { APP_RECIPES } from '../recipes.js';
import { scaleRecipeForPortions, normalizePortions, normalizeMealSelection, formatIngredientAmount, formatPortionQuantity } from '../modules/recipe-portions.js';
import { normalizeRecipeForStorage, validateRecipeSteps } from '../modules/recipe-domain.js';
import { buildRecipeSchedule, createPlaySession } from '../modules/play-engine.js';
import { serializeCookingState, restoreCookingState } from '../modules/cooking-state.js';
import { buildShoppingList } from '../modules/units.js';
import { toCloudRecords, mergePendingState } from '../modules/cloud-records.js';

const recipe = id => APP_RECIPES.find(recipe => recipe.id === id);
const action = (recipe, title) => recipe.steps.find(step => step.title === title);

test('all 108 included recipes scale at 1, 2 and 4 portions without changing their baseline', () => {
  const baseline = JSON.stringify(APP_RECIPES);
  for (const source of APP_RECIPES) {
    for (const portions of [1, 2, 4]) {
      const scaled = scaleRecipeForPortions(normalizeRecipeForStorage(source), portions);
      assert.equal(scaled.portions, portions);
      assert.equal(scaled.timingIsOriginal, false, source.title);
      validateRecipeSteps(scaled.steps);
      for (const [index, ingredient] of scaled.ingredients.entries()) {
        assert.equal(ingredient.amount, source.ingredients[index].amount * portions / source.servings);
        assert.ok(ingredient.amount > 0, source.title);
      }
      for (const step of scaled.steps) {
        assert.ok(['fixed', 'quantity', 'batch'].includes(step.scaling.mode), source.title);
        assert.ok(Number.isFinite(step.duration) && step.duration >= 1);
        assert.equal(/\{\d+\}|undefined|NaN/.test(step.action), false, `${source.title}: ${step.title}`);
      }
      for (const cooks of [1, 2]) {
        const schedule = buildRecipeSchedule(scaled, { availableCooks: cooks });
        const byId = new Map(schedule.steps.map(step => [step.id, step]));
        for (const step of schedule.steps) for (const id of step.dependsOn) assert.ok(byId.get(id).end <= step.start);
      }
    }
  }
  assert.equal(JSON.stringify(APP_RECIPES), baseline);
  const copy = scaleRecipeForPortions(APP_RECIPES[0], 1);
  copy.steps[0].scaling.mode = 'fixed';
  assert.equal(APP_RECIPES[0].steps[0].scaling.mode, 'quantity');
});

test('potato counts and preparation grow together, while fermentation stays fixed', () => {
  const one = scaleRecipeForPortions(recipe('veg-masala-dosa'), 1);
  const four = scaleRecipeForPortions(recipe('veg-masala-dosa'), 4);
  assert.match(formatIngredientAmount(one.ingredients.find(i => i.name === 'Potatoes')), /1 medium potato/);
  assert.equal(action(four, 'Peel potatoes').duration, action(one, 'Peel potatoes').duration * 4);
  assert.equal(action(one, 'Ferment batter').duration, 43200);
  assert.equal(action(four, 'Ferment batter').duration, 43200);
  assert.match(action(one, 'Cook dosas').action, /3 thin spirals/);
  assert.match(action(four, 'Cook dosas').action, /12 thin spirals/);
  assert.equal(action(four, 'Cook dosas').duration, action(one, 'Cook dosas').duration * 4);
});

test('water references, fractional onions, divided butter and flatbread yields stay consistent', () => {
  const one = scaleRecipeForPortions(recipe('handpicked-upma'), 1);
  assert.match(action(one, 'Pour in water').action, /1¼ cups of water/);
  assert.equal(one.ingredients.find(i => i.name === 'Water').amount, 1.25);
  assert.match(action(one, 'Chop onion').action, /½ piece onion/);
  const bhaji = scaleRecipeForPortions(recipe('handpicked-pav-bhaji'), 4);
  assert.match(action(bhaji, 'Melt curry butter').action, /4 tablespoons/);
  assert.match(action(bhaji, 'Melt toast butter').action, /2 tablespoons/);
  const paratha = scaleRecipeForPortions(recipe('veg-aloo-paratha'), 1);
  assert.match(action(paratha, 'Fill dough portions').action, /3 equal dough portions/);
  assert.equal(action(paratha, 'Cook parathas').duration, 540);
  assert.match(action(paratha, 'Roll parathas').action, /15 cm/);
});

test('scaling a previous selection uses its source and applies experience only once', () => {
  const source = recipe('handpicked-poha');
  const four = scaleRecipeForPortions(source, 4);
  assert.deepEqual(scaleRecipeForPortions(four, 1), scaleRecipeForPortions(source, 1));
  assert.deepEqual(scaleRecipeForPortions(normalizeRecipeForStorage(four), 1), scaleRecipeForPortions(source, 1));
  const session = createPlaySession(four, 1.5, 2);
  assert.equal(session.portions, 4);
  assert.equal(session.upcoming.find(s => s.id === 'onion').duration, 270);
  assert.equal(session.upcoming.find(s => s.id === 'soften').duration, 180);
  const restored = restoreCookingState(serializeCookingState([], session)).playSession;
  assert.equal(restored.portions, 4);
  assert.deepEqual(restored.ingredients, four.ingredients);
  assert.equal(restored.upcoming.find(s => s.id === 'onion').duration, 270);
});

test('custom recipes scale ingredients and retain unannotated instructions and times', () => {
  const source = structuredClone(recipe('handpicked-upma'));
  for (const step of source.steps) delete step.scaling;
  const scaled = scaleRecipeForPortions(source, 4);
  assert.equal(scaled.timingIsOriginal, true);
  assert.equal(scaled.ingredients[0].amount, source.ingredients[0].amount * 2);
  assert.deepEqual(scaled.steps, source.steps);
});

test('multi-phase batches repeat full cooking cycles and recipes without ingredients remain playable', () => {
  const salmon = scaleRecipeForPortions(recipe('r1'), 4);
  const schedule = buildRecipeSchedule(salmon, { availableCooks: 2 });
  const firstRemoval = schedule.steps.find(step => step.id === 'remove');
  const secondPlace = schedule.steps.find(step => step.id === 'place-batch-2');
  assert.ok(firstRemoval.end <= secondPlace.start);
  assert.equal(salmon.steps.filter(step => step.id.startsWith('sear-second')).length, 2);
  const pancakes = scaleRecipeForPortions(recipe('r5'), 1);
  assert.equal(pancakes.steps.filter(step => step.id.startsWith('pour')).length, 1);
  validateRecipeSteps(pancakes.steps);
  const custom = structuredClone(recipe('handpicked-poha'));
  delete custom.ingredients;
  assert.deepEqual(scaleRecipeForPortions(custom, 1).ingredients, []);
});

test('ingredient-based instruction references follow edits and compatible unit changes', () => {
  const source = normalizeRecipeForStorage(structuredClone(recipe('handpicked-upma')));
  const water = source.ingredients.find(ingredient => ingredient.name === 'Water');
  water.amount = 720; water.unit = 'ml';
  const scaled = scaleRecipeForPortions(source, 1);
  assert.equal(scaled.ingredients.find(ingredient => ingredient.name === 'Water').amount, 360);
  assert.match(action(scaled, 'Pour in water').action, /1½ cups of water/);
});

test('planner legacy migration, different portions and cloud merges preserve recipe links', () => {
  assert.deepEqual(normalizeMealSelection('handpicked-upma'), { recipeId: 'handpicked-upma', portions: 1 });
  assert.equal(normalizeMealSelection(null), null);
  const base = { scheduledMeals: { Monday: 'handpicked-upma' } };
  const local = { scheduledMeals: { Monday: { recipeId: 'handpicked-upma', portions: 4 } } };
  const remote = { scheduledMeals: { Monday: 'handpicked-upma', Tuesday: { recipeId: 'r2', portions: 2 } } };
  const merged = mergePendingState(remote, base, local);
  assert.deepEqual(merged.scheduledMeals.Monday, local.scheduledMeals.Monday);
  assert.deepEqual(merged.scheduledMeals.Tuesday, remote.scheduledMeals.Tuesday);
  assert.deepEqual(toCloudRecords(base).get('meals/Monday'), { recipeId: 'handpicked-upma', portions: 1 });
  const list = buildShoppingList([scaleRecipeForPortions(recipe('handpicked-upma'), 1), scaleRecipeForPortions(recipe('handpicked-upma'), 4)], [{ name: 'Onion', quantity: 1, unit: 'pcs' }]);
  assert.equal(list.find(i => i.name === 'Onion').amount, 1.5);
  assert.equal(formatPortionQuantity(0.25), '¼');
  for (const invalid of [0, -1, 1.5, '', NaN, Infinity, 'wat']) assert.equal(normalizePortions(invalid), 1);
});
