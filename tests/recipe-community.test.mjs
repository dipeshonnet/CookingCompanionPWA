import test from 'node:test';
import assert from 'node:assert/strict';
import { STATE, RUNTIME } from '../modules/state.js';
import { BackendAuthDB, createBackend } from '../modules/backend-auth-db.js';
import { publishRecipes, refreshSharedRecipes, rateRecipe, recipeScore, ratingLevel } from '../modules/recipe-community.js';
import { getDefaultRecipe, getAllRecipes } from '../modules/recipe-domain.js';
import { buildUserProfile } from '../modules/user-profile.js';
import { loadStateFromStorage } from '../modules/storage.js';

test('published snapshots, account isolation, repeat sharing and community rating averages', async () => {
  const original = { ...BackendAuthDB };
  const previousState = { ...STATE }, previousRuntime = { ...RUNTIME };
  const previousStorage = globalThis.localStorage, previousDocument = globalThis.document;
  const values = new Map(), records = new Map();
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  globalThis.document = { getElementById: () => null };
  BackendAuthDB.isReady = () => false; // Keep private profile saves local in this fixture.
  BackendAuthDB.publishRecipe = async (id, data) => records.set(id, structuredClone(data));
  BackendAuthDB.loadSharedRecipes = async () => [...records].map(([id, data]) => ({ id, ...data, scores: [5, 3] }));
  BackendAuthDB.rateSharedRecipe = async (id, score) => { assert.ok(records.has(id)); assert.equal(score, 1); };
  try {
    Object.assign(RUNTIME, { currentAuthUid: 'author-a', storageScope: 'author-a', suppressCloudSave: true });
    Object.assign(STATE, { user: buildUserProfile({ name: 'A Chef' }), customRecipes: [{ ...getDefaultRecipe('handpicked-poha'), title: 'A private version', baseRecipeId: 'handpicked-poha' }], sharedRecipes: [], communityRatings: {} });
    await publishRecipes(['handpicked-poha']);
    await publishRecipes(['handpicked-poha']);
    assert.equal(records.size, 1);
    const published = STATE.sharedRecipes[0];
    assert.equal(published.authorName, 'A Chef');
    assert.equal(published.baseRecipeId, undefined);
    assert.equal(published.rating, 0);
    assert.equal(getAllRecipes().filter(recipe => recipe.title === 'A private version').length, 1);
    STATE.customRecipes[0].title = 'An unshared change';
    assert.equal(published.title, 'A private version');

    RUNTIME.currentAuthUid = 'reader-b';
    loadStateFromStorage('reader-b');
    assert.equal(STATE.sharedRecipes.length, 0);
    BackendAuthDB.isReady = () => true;
    await refreshSharedRecipes();
    assert.equal(STATE.sharedRecipes[0].authorName, 'A Chef');
    assert.equal(recipeScore(STATE.sharedRecipes[0]), 4);
    assert.equal(ratingLevel(4), 5);
    assert.equal(getAllRecipes().filter(recipe => recipe.id === published.id).length, 1);
    BackendAuthDB.isReady = () => false;
    await rateRecipe(STATE.sharedRecipes[0], 1);
    assert.equal(STATE.user.recipeRatings[published.id], 1);
    await assert.rejects(() => rateRecipe(published, 4), /Choose/);
    loadStateFromStorage('reader-b');
    assert.equal(STATE.user.recipeRatings[published.id], 1);
    assert.equal(STATE.sharedRecipes[0].rating, 4);
    loadStateFromStorage('guest');
    assert.equal(STATE.sharedRecipes.length, 0);
    assert.equal(STATE.user.recipeRatings[published.id], undefined);
    assert.deepEqual([0, 1, 3, 5].map(ratingLevel), [0, 1, 3, 5]);
  } finally {
    Object.assign(BackendAuthDB, original);
    Object.assign(STATE, previousState);
    Object.assign(RUNTIME, previousRuntime);
    globalThis.localStorage = previousStorage;
    globalThis.document = previousDocument;
  }
});

test('community adapter stores one vote per account and returns published recipes with scores', async () => {
  const records = new Map();
  const auth = { currentUser: { uid: 'author' } };
  const ref = path => ({
    doc: id => ref(`${path}/${id}`), collection: name => ref(`${path}/${name}`), limit: () => ref(path),
    set: async value => records.set(path, structuredClone(value)),
    get: async () => ({ docs: [...records].filter(([key]) => key.startsWith(`${path}/`) && key.split('/').length === path.split('/').length + 1).map(([key, value]) => ({ id: key.split('/').at(-1), ref: ref(key), data: () => value })) })
  });
  const backend = createBackend({ apiKey: 'x', authDomain: 'x', projectId: 'x', appId: 'x' }, () => ({ apps: [{}], auth: () => auth, firestore: () => ({ collection: ref }) }));
  await backend.init();
  await assert.rejects(() => backend.publishRecipe('demo', { authorId: 'another' }), /Sign in/);
  await backend.publishRecipe('demo', { authorId: 'author', authorName: 'Chef', recipe: { title: 'Shared recipe' } });
  auth.currentUser = { uid: 'reader' };
  await backend.rateSharedRecipe('demo', 5);
  await backend.rateSharedRecipe('demo', 3);
  assert.deepEqual((await backend.loadSharedRecipes())[0].scores, [3]);
  auth.currentUser = { uid: 'second-reader' };
  await backend.rateSharedRecipe('demo', 1);
  assert.deepEqual((await backend.loadSharedRecipes())[0].scores, [3, 1]);
  auth.currentUser = null;
  await assert.rejects(() => backend.rateSharedRecipe('demo', 5), /Sign in/);
  assert.deepEqual(await backend.loadSharedRecipes(), []);
});
