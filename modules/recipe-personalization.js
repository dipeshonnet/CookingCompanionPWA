import { STATE } from './state.js';
import { getDefaultRecipe, isPersonalRecipe, normalizeRecipeForStorage } from './recipe-domain.js';
import { saveStateToStorage } from './storage.js';

function persistRecipes(next) {
  const previous = STATE.customRecipes;
  STATE.customRecipes = next;
  if (!saveStateToStorage()) { STATE.customRecipes = previous; return false; }
  return true;
}

export function savePersonalRecipe(draft) {
  const base = getDefaultRecipe(draft.id);
  const recipe = normalizeRecipeForStorage({ ...draft, ...(base ? { baseRecipeId: base.id } : {}) });
  return persistRecipes([recipe, ...STATE.customRecipes.filter(item => item.id !== recipe.id)]) ? recipe : null;
}

export function revertPersonalRecipe(id) {
  if (!STATE.customRecipes.some(recipe => recipe.id === id && isPersonalRecipe(recipe))) return false;
  return persistRecipes(STATE.customRecipes.filter(recipe => recipe.id !== id));
}

// Portable recipes never carry authority to overwrite another account's default.
export function recipeForImport(recipe) {
  const { baseRecipeId, ...copy } = recipe;
  return normalizeRecipeForStorage({ ...copy, ...(baseRecipeId ? { id: `import-${crypto.randomUUID()}` } : {}) });
}
