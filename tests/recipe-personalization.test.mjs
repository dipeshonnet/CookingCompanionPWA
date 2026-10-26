import test from 'node:test';
import assert from 'node:assert/strict';
import { APP_RECIPES } from '../recipes.js';
import { VEGETARIAN_RECIPES } from '../modules/vegetarian-recipes.js';
import { STATE, RUNTIME } from '../modules/state.js';
import { getAllRecipes, getDefaultRecipe, getRecipeById, isPersonalRecipe, normalizeRecipeForStorage } from '../modules/recipe-domain.js';
import { savePersonalRecipe, revertPersonalRecipe, recipeForImport } from '../modules/recipe-personalization.js';
import { loadStateFromStorage, hydrateStateFromPayload, getPersistentState, scopedStorageKey } from '../modules/storage.js';
import { toCloudRecords, diffCloudRecords, mergePendingState } from '../modules/cloud-records.js';
import { createPlaySession } from '../modules/play-engine.js';
import { buildShoppingList } from '../modules/units.js';

function fixture(run) {
  const state = { ...STATE }, runtime = { ...RUNTIME };
  const globals = { localStorage: globalThis.localStorage, document: globalThis.document, alert: globalThis.alert };
  const values = new Map(), alerts = [];
  Object.assign(STATE, { customRecipes: [], pantry: [], scheduledMeals: {}, user: { likedRecipeIds: [] } });
  Object.assign(RUNTIME, { storageScope: 'account-a', currentAuthUid: '', suppressCloudSave: true });
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  globalThis.document = { getElementById: () => null };
  globalThis.alert = message => alerts.push(message);
  try { return run({ values, alerts }); }
  finally { Object.assign(STATE, state); Object.assign(RUNTIME, runtime); Object.assign(globalThis, globals); }
}

test('100 additions retain the original eight and satisfy cuisine and meal quotas', () => {
  assert.equal(VEGETARIAN_RECIPES.length, 100);
  assert.equal(APP_RECIPES.length, 108);
  assert.deepEqual(APP_RECIPES.slice(0, 8).map(r => r.id), ['handpicked-poha', 'handpicked-upma', 'handpicked-pav-bhaji', 'r1', 'r2', 'r3', 'r4', 'r5']);
  assert.equal(new Set(APP_RECIPES.map(r => r.id)).size, 108);
  assert.equal(new Set(APP_RECIPES.map(r => r.title.toLowerCase())).size, 108);
  for (const [category, indian, other] of [['Breakfast', 20, 5], ['Lunch', 28, 7], ['Dinner', 32, 8]]) {
    assert.equal(VEGETARIAN_RECIPES.filter(r => r.category === category && r.tags.includes('Indian')).length, indian);
    assert.equal(VEGETARIAN_RECIPES.filter(r => r.category === category && !r.tags.includes('Indian')).length, other);
  }
});

test('new recipes have complete, egg-free vegetarian quantities and explicit specialty ingredients', () => {
  for (const r of VEGETARIAN_RECIPES) {
    assert.ok(r.description.length > 20 && r.servings > 0 && r.steps.length >= 4, r.title);
    assert.ok(r.tags.includes('Vegetarian') && r.tags.includes('Egg-Free'));
    for (const i of r.ingredients) {
      assert.ok(Number.isFinite(i.amount) && i.amount > 0 && i.unit && i.name, r.title);
      const name = i.name.replace(/egg-free/ig, '');
      assert.doesNotMatch(name, /\b(eggs?|chicken|beef|pork|lamb|fish|shrimp|prawn|gelatin|gelatine|lard)\b/i, `${r.title}: ${i.name}`);
      if (/\b(pasta|noodles|lasagne|bread|flatbreads|tortillas|pav|granola)\b/i.test(i.name)) assert.match(i.name, /egg-free/i, `${r.title}: ${i.name}`);
      if (/\b(feta|mozzarella|ricotta|cheddar|cheese)\b/i.test(i.name)) assert.match(i.name, /vegetarian-rennet/i, `${r.title}: ${i.name}`);
    }
    if (r.tags.includes('Vegan')) assert.equal(r.ingredients.some(i => /\b(yogurt|paneer|ghee|butter|cream|cheese)\b/i.test(i.name)), false, r.title);
  }
  for (const title of ['Idli', 'Appam', 'Dal Makhani', 'Ragda Pattice', 'Falafel Wraps', 'Margherita Pizza']) {
    assert.ok(VEGETARIAN_RECIPES.find(r => r.title === title).steps.some(s => s.attention === 'passive' && s.stepType === 'Prep' && s.duration >= 1800), title);
  }
});

test('personal saves replace one effective default and revert restores it without losing links', () => fixture(() => {
  const original = getDefaultRecipe('handpicked-poha'), before = structuredClone(original);
  STATE.scheduledMeals = { 'Monday-Dinner': original.id };
  STATE.user.likedRecipeIds = [original.id];
  const edited = savePersonalRecipe({ ...structuredClone(original), title: 'My Poha' });
  assert.equal(edited.baseRecipeId, original.id);
  assert.equal(getRecipeById(original.id).title, 'My Poha');
  assert.equal(getAllRecipes().length, 108);
  assert.equal(getAllRecipes().filter(r => r.id === original.id).length, 1);
  savePersonalRecipe({ ...edited, description: 'Less oil for my kitchen.' });
  assert.equal(STATE.customRecipes.length, 1);
  assert.equal(getRecipeById(original.id).description, 'Less oil for my kitchen.');
  const cloudBeforeRevert = toCloudRecords(getPersistentState());
  assert.equal(revertPersonalRecipe(original.id), true);
  assert.deepEqual(diffCloudRecords(cloudBeforeRevert, toCloudRecords(getPersistentState())), [{ path: `recipes/${original.id}`, remove: true }]);
  assert.equal(getRecipeById(original.id), original);
  assert.deepEqual(original, before);
  assert.deepEqual(STATE.user.likedRecipeIds, [original.id]);
  assert.deepEqual(STATE.scheduledMeals, { 'Monday-Dinner': original.id });
}));

test('custom recipe editing preserves its ID and offers no default revert', () => fixture(() => {
  const custom = recipeForImport({ ...APP_RECIPES[0], id: 'custom-test' });
  savePersonalRecipe(custom);
  savePersonalRecipe({ ...custom, title: 'Updated custom' });
  assert.equal(STATE.customRecipes.length, 1);
  assert.equal(getRecipeById('custom-test').title, 'Updated custom');
  assert.equal(isPersonalRecipe(getRecipeById('custom-test')), false);
  assert.equal(revertPersonalRecipe('custom-test'), false);
  assert.equal(getAllRecipes().length, 109);
}));

test('normalization retains valid linkage and image credits but ignores forged linkage', () => {
  const original = APP_RECIPES[0];
  const normalized = normalizeRecipeForStorage({ ...original, baseRecipeId: original.id });
  assert.equal(normalized.baseRecipeId, original.id);
  assert.equal(normalized.imageCredit, original.imageCredit);
  assert.equal(normalizeRecipeForStorage({ ...original, baseRecipeId: 'r1' }).baseRecipeId, undefined);
  assert.equal(normalizeRecipeForStorage({ ...original, id: 'custom', baseRecipeId: 'custom' }).baseRecipeId, undefined);
});

test('account reload, hydration and offline merging retain personal versions and synchronized deletion', () => fixture(() => {
  const original = APP_RECIPES[0];
  savePersonalRecipe({ ...original, title: 'Account A Poha' });
  const base = getPersistentState();
  loadStateFromStorage('account-b');
  assert.equal(getRecipeById(original.id).title, original.title);
  savePersonalRecipe({ ...original, title: 'Account B Poha' });
  loadStateFromStorage('account-a');
  assert.equal(getRecipeById(original.id).title, 'Account A Poha');
  hydrateStateFromPayload(JSON.parse(JSON.stringify(base)));
  assert.equal(getRecipeById(original.id).title, 'Account A Poha');
  const remote = structuredClone(base);
  remote.customRecipes.push({ ...normalizeRecipeForStorage(original), id: 'remote-custom' });
  revertPersonalRecipe(original.id);
  const merged = mergePendingState(remote, base, getPersistentState());
  assert.deepEqual(merged.customRecipes.map(r => r.id), ['remote-custom']);
  hydrateStateFromPayload(merged);
  assert.equal(getRecipeById(original.id), original);
  loadStateFromStorage('account-b');
  assert.equal(getRecipeById(original.id).title, 'Account B Poha');
}));

test('personal exports import as independent recipes without overriding the recipient', () => fixture(() => {
  const original = APP_RECIPES[0];
  const personal = savePersonalRecipe({ ...original, title: 'Exported Poha' });
  const imported = recipeForImport(JSON.parse(JSON.stringify(personal)));
  assert.match(imported.id, /^import-/);
  assert.notEqual(imported.id, original.id);
  assert.equal(imported.baseRecipeId, undefined);
  assert.equal(imported.title, personal.title);
  assert.equal(imported.imageCredit, original.imageCredit);
  assert.notEqual(recipeForImport(personal).id, imported.id);
  assert.equal(recipeForImport({ ...original, id: 'existing-custom' }).id, 'existing-custom');
  savePersonalRecipe(imported);
  assert.equal(getRecipeById(original.id).title, personal.title);
}));

test('failed storage saves and reverts keep the previously saved recipe in memory', () => fixture(({ values, alerts }) => {
  const original = APP_RECIPES[0];
  const saved = savePersonalRecipe({ ...original, title: 'Saved Poha' });
  const storageBefore = values.get(scopedStorageKey('cook_comp_custom_recipes'));
  const previousError = console.error;
  console.error = () => {};
  globalThis.localStorage.setItem = () => { throw new Error('Quota exceeded'); };
  try {
    assert.equal(savePersonalRecipe({ ...saved, title: 'Unsaved Poha' }), null);
    assert.equal(getRecipeById(original.id).title, 'Saved Poha');
    assert.equal(revertPersonalRecipe(original.id), false);
    assert.equal(getRecipeById(original.id).title, 'Saved Poha');
    assert.equal(values.get(scopedStorageKey('cook_comp_custom_recipes')), storageBefore);
    assert.equal(alerts.length, 2);
  } finally { console.error = previousError; }
}));

test('future cooking and shopping use edits while already created sessions remain frozen', () => fixture(() => {
  const original = APP_RECIPES[0];
  const session = createPlaySession(original);
  const firstAction = structuredClone(session.upcoming[0]);
  const personal = structuredClone(original);
  personal.ingredients[0].amount *= 2;
  personal.steps[0].action = 'Rinse gently with cold water.';
  personal.steps[0].duration += 30;
  savePersonalRecipe(personal);
  assert.equal(buildShoppingList([getRecipeById(original.id)], []).find(i => i.name === personal.ingredients[0].name).amount, personal.ingredients[0].amount);
  assert.equal(createPlaySession(getRecipeById(original.id)).upcoming[0].duration, personal.steps[0].duration);
  assert.deepEqual(session.upcoming[0], firstAction);
}));

test('a failed sync marker cannot persist an edit or revert reported as failed', () => fixture(({ values }) => {
  const original = APP_RECIPES[0];
  const saved = savePersonalRecipe({ ...original, title: 'Saved version' });
  const key = scopedStorageKey('cook_comp_custom_recipes');
  const before = values.get(key), write = globalThis.localStorage.setItem, logError = console.error;
  RUNTIME.currentAuthUid = 'account-a';
  globalThis.localStorage.setItem = (key, value) => {
    if (key === scopedStorageKey('dirty')) throw new Error('Quota at sync marker');
    write(key, value);
  };
  console.error = () => {};
  try {
    assert.equal(savePersonalRecipe({ ...saved, title: 'Failed edit' }), null);
    assert.equal(values.get(key), before);
    assert.equal(revertPersonalRecipe(original.id), false);
    assert.equal(values.get(key), before);
    assert.equal(getRecipeById(original.id).title, 'Saved version');
  } finally { console.error = logError; }
}));
