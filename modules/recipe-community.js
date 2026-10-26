import { STATE, RUNTIME } from './state.js';
import { BackendAuthDB } from './backend-auth-db.js';
import { normalizeRecipeForStorage } from './recipe-domain.js';
import { saveStateToStorage, scopedStorageKey } from './storage.js';

export const RATING_OPTIONS = [{ label: 'High', score: 5 }, { label: 'Medium', score: 3 }, { label: 'Low', score: 1 }];

export function sharedVersion(recipe) {
  return STATE.sharedRecipes.find(item => item.id === recipe.id ||
    (item.authorId === (RUNTIME.currentAuthUid || 'guest') && item.sourceRecipeId === recipe.id));
}

export function recipeScore(recipe) {
  const shared = sharedVersion(recipe);
  const community = shared && STATE.communityRatings[shared.id];
  return community || STATE.user.recipeRatings?.[shared?.id || recipe.id] || Math.min(5, Math.max(0, Number(shared?.rating ?? recipe.rating) || 0));
}

export function ratingLevel(score) { return score >= 4 ? 5 : score >= 2 ? 3 : score > 0 ? 1 : 0; }

function cacheShared() {
  localStorage.setItem(scopedStorageKey('shared-recipes'), JSON.stringify(STATE.sharedRecipes));
}

export async function publishRecipes(ids) {
  const scope = RUNTIME.storageScope;
  const authorId = RUNTIME.currentAuthUid || 'guest';
  const authorName = STATE.user.name.trim().slice(0, 100) || 'Chef Guest';
  for (const sourceRecipeId of ids) {
    const source = STATE.customRecipes.find(recipe => recipe.id === sourceRecipeId);
    if (!source) throw new Error('Select a saved recipe to share.');
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${authorId}:${sourceRecipeId}`));
    const id = `shared-${Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')}`;
    const { baseRecipeId, ...copy } = source;
    const recipe = normalizeRecipeForStorage({ ...copy, id, rating: 0, authorId, authorName, sourceRecipeId });
    if (scope !== RUNTIME.storageScope) throw new Error('Your account changed. Please try again.');
    if (authorId !== 'guest') await BackendAuthDB.publishRecipe(id, { authorId, authorName, sourceRecipeId, recipe });
    if (scope !== RUNTIME.storageScope) return;
    STATE.sharedRecipes = [recipe, ...STATE.sharedRecipes.filter(item => item.id !== id)];
    cacheShared();
  }
}

export async function refreshSharedRecipes() {
  if (!RUNTIME.currentAuthUid || !BackendAuthDB.isReady()) return;
  const scope = RUNTIME.storageScope;
  const records = await BackendAuthDB.loadSharedRecipes();
  if (scope !== RUNTIME.storageScope) return;
  const recipes = [], ratings = {};
  for (const record of records) {
    try {
      const scores = record.scores.filter(score => [1, 3, 5].includes(score));
      if (scores.length) ratings[record.id] = scores.reduce((sum, value) => sum + value, 0) / scores.length;
      recipes.push(normalizeRecipeForStorage({ ...record.recipe, rating: ratings[record.id] || 0, id: record.id, authorId: record.authorId, authorName: record.authorName, sourceRecipeId: record.sourceRecipeId }));
    } catch (error) { console.warn('Skipped an unavailable shared recipe:', error); }
  }
  STATE.sharedRecipes = recipes;
  STATE.communityRatings = ratings;
  cacheShared();
}

export async function rateRecipe(recipe, score) {
  if (![1, 3, 5].includes(score)) throw new Error('Choose High, Medium, or Low.');
  const scope = RUNTIME.storageScope;
  const shared = sharedVersion(recipe);
  if (shared && RUNTIME.currentAuthUid) await BackendAuthDB.rateSharedRecipe(shared.id, score);
  if (scope !== RUNTIME.storageScope) return;
  const previous = STATE.user.recipeRatings;
  STATE.user.recipeRatings = { ...previous, [shared?.id || recipe.id]: score };
  if (!saveStateToStorage()) { STATE.user.recipeRatings = previous; return; }
  if (shared && RUNTIME.currentAuthUid) await refreshSharedRecipes();
}
