import test from 'node:test';
import assert from 'node:assert/strict';
import { STATE, RUNTIME, STORAGE_KEYS } from '../modules/state.js';
import { normalizeRecipeForStorage, deriveRecipeTimes, recipeMatchesDietPreference, safeImageSource } from '../modules/recipe-domain.js';
import { createPlaySession, advancePlaySession } from '../modules/play-engine.js';
import { toCloudRecords, diffCloudRecords, mergePendingState } from '../modules/cloud-records.js';
import { createBackend } from '../modules/backend-auth-db.js';
import { convertQuantity, buildShoppingList, availableQuantity } from '../modules/units.js';
import { buildUserProfile } from '../modules/user-profile.js';
import { loadStateFromStorage, saveStateToStorage, getAiProvider, setAiProvider, getApiKey, setApiKey, getPersistentState, scopedStorageKey } from '../modules/storage.js';
import { fetchIngredientNutrition, fetchCustomRecipe } from '../ai.js';
import { AI_PROVIDERS } from '../modules/ai-providers.js';
import { APP_CONFIG } from '../modules/app-config.js';
import { parseRecipeDraftFromText } from '../modules/recipe-voice.js';

const step = (cook, duration, stepType = 'Cook') => ({ item: 'Tomato', action: 'Stir in pan', cook, duration, stepType });
const recipe = { id: 'demo', title: 'Demo', cookCount: 2, ingredients: [{ name: 'Tomato', amount: 100, unit: 'g' }], steps: [step('Cook 1', 4), step('Cook 2', 3), step('Cook 1', 2)] };

test('recipe timings separate prep/cook, round up, and retain zero cook time', () => {
  assert.deepEqual(deriveRecipeTimes([step('Cook 1', 61, 'Prep'), step('Cook 2', 90)]), { prepTime: 2, cookTime: 2 });
  const prepOnly = normalizeRecipeForStorage({ ...recipe, steps: [step('Cook 1', 60, 'Prep')] });
  assert.equal(prepOnly.cookTime, 0);
  assert.equal(prepOnly.prepTime, 1);
});

test('recipe normalization validates imported fields and image schemes', () => {
  const normalized = normalizeRecipeForStorage({ title: 'A', ingredients: [null, { name: 'Rice', amount: -4 }], steps: [null], servings: 0, image: 'javascript:alert(1)' });
  assert.equal(normalized.servings, 1);
  assert.equal(normalized.ingredients[0].amount, 0);
  assert.equal(normalized.image, 'assets/logo.png');
  assert.equal(normalized.steps[0].cook, 'Cook 1');
  assert.match(normalized.id, /^[\w-]+$/);
  assert.equal(safeImageSource('https://example.com/rice.jpg'), 'https://example.com/rice.jpg');
});

test('diet filters allow vegan for vegetarian but do not equate low-carb with keto', () => {
  assert.equal(recipeMatchesDietPreference({ tags: ['Vegan'] }, 'Vegetarian'), true);
  assert.equal(recipeMatchesDietPreference({ tags: ['Vegetarian'] }, 'Vegan'), false);
  assert.equal(recipeMatchesDietPreference({ tags: ['Low-Carb'] }, 'Keto'), false);
});

test('profile experiences use constrained values and preserve likes', () => {
  assert.equal(buildUserProfile({ experience: 'Unknown' }).experience, 'Expert');
  assert.deepEqual(buildUserProfile({ likedRecipeIds: ['r1', null, 5] }).likedRecipeIds, ['r1']);
});

test('two cooks run independently without losing the first second', () => {
  const session = createPlaySession(recipe);
  const started = advancePlaySession(session, 1000);
  assert.equal(started.started.length, 2);
  assert.equal(session.running['Cook 1'].timeLeft, 4);
  assert.equal(session.running['Cook 2'].timeLeft, 3);
  advancePlaySession(session, 4000);
  assert.equal(session.completed.length, 1);
  assert.equal(session.running['Cook 1'].timeLeft, 1);
  const transition = advancePlaySession(session, 5000);
  assert.equal(transition.started.length, 1);
  assert.equal(session.running['Cook 1'].timeLeft, 2);
  assert.equal(advancePlaySession(session, 7000).done, true);
  assert.equal(session.completed.length, 3);
});

test('beginner/somewhat multipliers and deadlines survive delayed callbacks', () => {
  const beginner = createPlaySession(recipe, 2);
  advancePlaySession(beginner, 0);
  assert.equal(beginner.running['Cook 1'].duration, 8);
  advancePlaySession(beginner, 10000);
  assert.equal(beginner.completed.length, 2);
  assert.equal(beginner.running['Cook 1'].timeLeft, 4);
  assert.equal(createPlaySession(recipe, 1.5).upcoming[0].duration, 6);
});

test('last three seconds beep once each, including simultaneous cook timers', () => {
  const session = createPlaySession({ ...recipe, steps: [step('Cook 1', 5), step('Cook 2', 5)] });
  advancePlaySession(session, 0);
  assert.equal(advancePlaySession(session, 1000).beep, false);
  for (const now of [2000, 3000, 4000]) {
    assert.equal(advancePlaySession(session, now).beep, true);
    assert.equal(advancePlaySession(session, now + 50).beep, false);
  }
  assert.equal(advancePlaySession(session, 5000).beep, false);
});

test('quantity conversions do not subtract incompatible units or similarly named foods', () => {
  assert.equal(convertQuantity(1, 'kg', 'g'), 1000);
  assert.equal(convertQuantity(2, 'cups', 'ml'), 480);
  assert.equal(convertQuantity(100, 'g', 'pcs'), null);
  assert.equal(availableQuantity([{ name: 'Chicken broth', quantity: 1000, unit: 'g' }], { name: 'Chicken', unit: 'g' }), 0);
});

test('shopping list sums compatible units and repeated scheduled meals', () => {
  const list = buildShoppingList([recipe, recipe, { ingredients: [{ name: 'Tomato', amount: 0.1, unit: 'kg' }] }], [{ name: 'Tomato', quantity: 0.2, unit: 'kg' }]);
  assert.equal(list.length, 1);
  assert.equal(list[0].amount, 100);
});

test('cloud records only write changed documents and delete removed meals', () => {
  const payload = { user: { name: 'A' }, pantry: [{ id: 'p1', name: 'Rice', quantity: 1 }], customRecipes: [recipe], scheduledMeals: { 'Monday-Dinner': 'demo' } };
  const old = toCloudRecords(payload);
  assert.deepEqual(diffCloudRecords(old, toCloudRecords(payload)), []);
  const next = structuredClone(payload);
  next.pantry[0].quantity = 2;
  delete next.scheduledMeals['Monday-Dinner'];
  assert.deepEqual(diffCloudRecords(old, toCloudRecords(next)).map(c => [c.path, !!c.remove]), [['pantry/p1', false], ['meals/Monday-Dinner', true]]);
});

test('offline merge preserves unrelated records created on another device', () => {
  const base = { user: {}, pantry: [], customRecipes: [recipe], scheduledMeals: {} };
  const remote = structuredClone(base);
  remote.customRecipes.push({ ...recipe, id: 'remote' });
  const local = structuredClone(base);
  local.scheduledMeals['Friday-Dinner'] = recipe.id;
  const merged = mergePendingState(remote, base, local);
  assert.equal(merged.customRecipes.length, 2);
  assert.equal(merged.scheduledMeals['Friday-Dinner'], 'demo');
});

test('malformed legacy storage is isolated and account API keys never leak', () => {
  const values = new Map([[STORAGE_KEYS.USER, '{broken'], [STORAGE_KEYS.PANTRY, '["Rice"]'], [STORAGE_KEYS.CUSTOM_RECIPES, '{}']]);
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  globalThis.document = { getElementById: () => null };
  loadStateFromStorage('guest');
  assert.equal(STATE.pantry[0].name, 'Rice');
  assert.equal(STATE.customRecipes.length, 0);
  setApiKey('guest-secret');
  saveStateToStorage({ sync: false });
  loadStateFromStorage('account-a');
  assert.equal(STATE.pantry.length, 0);
  assert.equal(getApiKey(), '');
  setApiKey('account-secret');
  loadStateFromStorage('guest');
  assert.equal(getApiKey(), 'guest-secret');
  assert.equal(STATE.pantry[0].name, 'Rice');
  assert.equal(values.get(STORAGE_KEYS.PANTRY), '["Rice"]');
  assert.equal(values.has(scopedStorageKey(STORAGE_KEYS.PANTRY, 'guest')), true);
  assert.equal(getPersistentState().user.loggedIn, undefined);
});

function fakeFirebase(records = new Map()) {
  const commits = [];
  const auth = { currentUser: { uid: 'a' } };
  const reference = path => ({ path, doc: id => reference(`${path}/${id}`), collection: name => reference(`${path}/${name}`),
    get: async () => path.split('/').length % 2 === 0
      ? { exists: records.has(path), data: () => records.get(path) }
      : { docs: [...records].filter(([key]) => key.startsWith(path + '/') && key.split('/').length === path.split('/').length + 1).map(([key, value]) => ({ id: key.split('/').at(-1), data: () => value })) }
  });
  const db = { collection: reference, doc: reference, batch: () => {
    const changes = [];
    return { set: (ref, value) => changes.push({ path: ref.path, value }), delete: ref => changes.push({ path: ref.path, remove: true }),
      commit: async () => { commits.push(changes); for (const c of changes) { if (c.remove) records.delete(c.path); else records.set(c.path, c.value); } } };
  } };
  return { sdk: { apps: [{}], auth: () => auth, firestore: () => db }, commits, records };
}

test('database adapter skips identical saves, replaces meals and enforces account ownership', async () => {
  const mock = fakeFirebase();
  const backend = createBackend({ apiKey: 'x', authDomain: 'x', projectId: 'x', appId: 'x' }, () => mock.sdk);
  await backend.init();
  const payload = { user: {}, pantry: [], customRecipes: [recipe], scheduledMeals: { Monday: 'demo' } };
  await backend.saveUserState('a', payload);
  assert.equal(mock.commits[0].at(-1).path, 'users/a/app/profile');
  await backend.saveUserState('a', payload);
  assert.equal(mock.commits.length, 1);
  await backend.saveUserState('a', { ...payload, scheduledMeals: {} });
  assert.equal(mock.records.has('users/a/meals/Monday'), false);
  await assert.rejects(() => backend.saveUserState('b', payload), /Not authenticated/);
  const loaded = await backend.loadUserState('a');
  assert.equal(loaded.customRecipes[0].id, 'demo');
  assert.equal(backend.needsMigration('a'), false);
});

test('backend batches large collections and commits migration marker last', async () => {
  const mock = fakeFirebase();
  const backend = createBackend({ apiKey: 'x', authDomain: 'x', projectId: 'x', appId: 'x' }, () => mock.sdk);
  await backend.init();
  await backend.saveUserState('a', { customRecipes: Array.from({ length: 500 }, (_, i) => ({ ...recipe, id: `r${i}` })) });
  assert.deepEqual(mock.commits.map(batch => batch.length), [450, 51]);
  assert.equal(mock.commits[1].at(-1).path, 'users/a/app/profile');
});

test('unconfigured cloud backend does not load external scripts', async () => {
  const backend = createBackend({});
  assert.equal(await backend.init(), false);
});


const aiNutrition = { calories: 100, protein_g: 2, carbs_g: 20, fat_g: 1, fiber_g: 1 };
const aiRecipe = { title: 'Demo', description: 'Demo recipe', category: 'Dinner', prepTime: 1, cookTime: 2, servings: 2, tags: ['Vegan'], ingredients: recipe.ingredients, steps: recipe.steps.map(s => ({ ...s, text: s.action })) };
const completion = (provider, content, truncated = false) => provider === 'gemini'
  ? { candidates: [{ finishReason: truncated ? 'MAX_TOKENS' : 'STOP', content: { parts: [{ thought: true, text: 'ignore this' }, { text: content }] } }] }
  : { choices: [{ finish_reason: truncated ? 'length' : 'stop', message: { content } }] };

for (const [provider, config] of Object.entries(AI_PROVIDERS)) {
  test(provider + ' routes recipes and nutrition with the correct authentication and schema', async () => {
    const original = globalThis.fetch;
    const requests = [];
    globalThis.fetch = async (url, options) => {
      requests.push([url, options]);
      const payload = JSON.parse(options.body);
      const schema = provider === 'gemini' ? payload.generationConfig.responseJsonSchema : payload.response_format.json_schema.schema;
      return { ok: true, json: async () => completion(provider, JSON.stringify(schema.properties.calories ? aiNutrition : aiRecipe)) };
    };
    try {
      assert.deepEqual(await fetchIngredientNutrition('secret', { name: 'Rice', quantity: 1, unit: 'cup' }, provider), aiNutrition);
      assert.deepEqual(await fetchCustomRecipe('secret', { ingredients: ['Rice'], cookCount: 2 }, provider), aiRecipe);
      assert.equal(requests.length, 2);
      for (const [url, options] of requests) {
        assert.equal(url, config.endpoint);
        assert.equal(url.includes('secret'), false);
        assert.equal(options.method, 'POST');
        assert.equal(options.headers['Content-Type'], 'application/json');
        assert.ok(options.signal instanceof AbortSignal);
        assert.equal(options.body.includes('secret'), false);
        const payload = JSON.parse(options.body);
        let schema;
        if (provider === 'gemini') {
          assert.equal(options.headers['x-goog-api-key'], 'secret');
          assert.equal(options.headers.Authorization, undefined);
          assert.equal(payload.generationConfig.responseMimeType, 'application/json');
          schema = payload.generationConfig.responseJsonSchema;
          assert.equal(payload.contents[0].role, 'user');
        } else {
          assert.equal(options.headers.Authorization, 'Bearer secret');
          assert.equal(options.headers['x-goog-api-key'], undefined);
          assert.equal(payload.model, config.model);
          assert.equal(payload.response_format.type, 'json_schema');
          assert.equal(payload.response_format.json_schema.strict, true);
          assert.equal(payload.reasoning_effort, provider === 'groq' ? 'low' : undefined);
          assert.deepEqual(payload.messages.map(message => message.role), ['system', 'user']);
          schema = payload.response_format.json_schema.schema;
        }
        const verifySchema = schema => {
          assert.equal(schema.type, schema.type.toLowerCase());
          if (schema.type === 'object') {
            assert.equal(schema.additionalProperties, false);
            assert.deepEqual([...schema.required].sort(), Object.keys(schema.properties).sort());
            Object.values(schema.properties).forEach(verifySchema);
          }
          if (schema.items) verifySchema(schema.items);
        };
        verifySchema(schema);
      }
      const payload = JSON.parse(requests[1][1].body);
      assert.match(provider === 'gemini' ? payload.contents[0].parts[0].text : payload.messages[1].content, /2 cooks/);
    } finally { globalThis.fetch = original; }
  });

  test(provider + ' rejects missing keys, errors and invalid responses without provider fallback', async () => {
    const original = globalThis.fetch;
    const calls = [
      () => fetchIngredientNutrition('secret', { name: 'Rice', quantity: 1, unit: 'cup' }, provider),
      () => fetchCustomRecipe('secret', { ingredients: ['Rice'] }, provider)
    ];
    try {
      globalThis.fetch = async () => { throw new Error('Must not fetch'); };
      await assert.rejects(() => fetchIngredientNutrition(' ', {}, provider), /API key/);
      for (const [status, pattern] of [[401, /rejected the API key/], [403, /rejected the API key/], [429, /rate limit or quota/], [500, /failed \(500\)/]]) {
        let count = 0;
        globalThis.fetch = async url => { count++; assert.equal(url, config.endpoint); return { ok: false, status }; };
        for (const call of calls) await assert.rejects(call, pattern);
        assert.equal(count, 2);
      }
      for (const [content, truncated, pattern] of [
        ['{}', true, /incomplete/],
        [null, false, /No .* returned/],
        ['{bad json', false, /invalid .* JSON/],
        ['{}', false, /invalid .* format/],
        ['null', false, /invalid .* format/],
        [JSON.stringify({ ...aiNutrition, calories: '100' }), false, /invalid .* format/]
      ]) {
        globalThis.fetch = async () => ({ ok: true, json: async () => completion(provider, content, truncated) });
        for (const call of calls) await assert.rejects(call, pattern);
      }
      globalThis.fetch = async () => ({ ok: true, json: async () => provider === 'gemini' ? { promptFeedback: { blockReason: 'SAFETY' } } : { choices: [{ message: { refusal: 'Declined' } }] } });
      for (const call of calls) await assert.rejects(call, /could not complete/);
    } finally { globalThis.fetch = original; }
  });
}

test('AI provider keys, selection and clearing are isolated by provider and account', () => {
  const values = new Map([
    [STORAGE_KEYS.GEMINI_KEY, 'old-raw-key'],
    [scopedStorageKey(STORAGE_KEYS.GEMINI_KEY, 'guest'), JSON.stringify('old-scoped-key')],
    [scopedStorageKey(STORAGE_KEYS.GEMINI_KEY, 'account-a'), JSON.stringify('old-account-key')]
  ]);
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  globalThis.document = { getElementById: () => null };
  loadStateFromStorage('guest');
  assert.equal(getAiProvider(), APP_CONFIG.defaultAiProvider);
  assert.equal(getApiKey(), '');
  assert.equal(getApiKey('gemini'), 'old-scoped-key');
  setApiKey('  groq-test-secret  ', 'groq');
  setApiKey('openai-test-secret', 'openai');
  for (const provider of Object.keys(AI_PROVIDERS)) {
    setAiProvider(provider);
    assert.equal(getApiKey(), provider === 'gemini' ? 'old-scoped-key' : provider + '-test-secret');
  }
  setAiProvider('openai');
  assert.equal(JSON.stringify(getPersistentState()).includes('test-secret'), false);
  assert.equal(JSON.stringify(getPersistentState()).includes('cook_comp_ai_provider'), false);
  loadStateFromStorage('account-a');
  assert.equal(getAiProvider(), APP_CONFIG.defaultAiProvider);
  assert.equal(getApiKey('openai'), '');
  assert.equal(getApiKey('groq'), '');
  assert.equal(getApiKey('gemini'), 'old-account-key');
  setAiProvider('gemini');
  loadStateFromStorage('guest');
  assert.equal(getAiProvider(), 'openai');
  assert.equal(getApiKey(), 'openai-test-secret');
  setApiKey('');
  assert.equal(getApiKey(), '');
  assert.equal(getApiKey('groq'), 'groq-test-secret');
  assert.equal(getApiKey('gemini'), 'old-scoped-key');
  assert.throws(() => setAiProvider('unknown'), /Choose OpenAI/);
  values.set(scopedStorageKey(STORAGE_KEYS.AI_PROVIDER), JSON.stringify('unknown'));
  assert.equal(getAiProvider(), APP_CONFIG.defaultAiProvider);
  loadStateFromStorage('other-account');
  assert.equal(getApiKey('gemini'), '');
});

test('legacy Gemini guest key migrates only to the guest Gemini slot', () => {
  const values = new Map([[STORAGE_KEYS.GEMINI_KEY, 'old-raw-key'], [scopedStorageKey('legacy-migrated', 'guest'), 'true']]);
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  globalThis.document = { getElementById: () => null };
  loadStateFromStorage('guest');
  assert.equal(getApiKey('gemini'), 'old-raw-key');
  assert.equal(getApiKey('groq'), '');
  setApiKey('', 'gemini');
  loadStateFromStorage('guest');
  assert.equal(getApiKey('gemini'), '');
  loadStateFromStorage('account-a');
  assert.equal(getApiKey('gemini'), '');
});

test('spoken recipe notes parse without an external AI service', () => {
  const draft = parseRecipeDraftFromText('Title: Tomato soup. Ingredients: 2 tomatoes, 1 cup water. Steps: Chop tomatoes for 2 minutes; Boil water for 5 minutes.');
  assert.ok(draft.ingredients.length > 0);
  assert.ok(draft.steps.length > 0);
});
