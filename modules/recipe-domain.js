import { normalizeActionType, inferActionType } from './action-types.js';
import { STATE, FALLBACK_RECIPE_IMAGE } from './state.js';
import { cleanText, toNonNegativeNumber } from './utils.js';
import { APP_RECIPES } from '../recipes.js';
import { normalizeRecipeSources } from './recipe-sources.js';
import { retainPortionSource } from './recipe-portions.js';

export function recipeMatchesDietPreference(recipe, preference = STATE.user.dietPreference || "None") {
  if (!preference || preference === "None") return true;
  const tags = (recipe.tags || []).map(tag => cleanText(tag).toLowerCase());
  const pref = cleanText(preference).toLowerCase();

  if (pref === "vegetarian") return tags.includes("vegetarian") || tags.includes("vegan");
  if (pref === "low-carb") return tags.includes("low-carb") || tags.includes("keto");
  if (pref === "keto") return tags.includes("keto");
  return tags.includes(pref);
}

export function getDefaultRecipe(id) {
  return APP_RECIPES.find(recipe => recipe.id === id);
}

export function isPersonalRecipe(recipe) {
  return Boolean(recipe?.baseRecipeId === recipe?.id && getDefaultRecipe(recipe?.id));
}

// Keep stable default IDs so likes and meal assignments resolve personal versions.
export function getAllRecipes() {
  const overrides = new Map(STATE.customRecipes.filter(isPersonalRecipe).map(recipe => [recipe.id, recipe]));
  return [
    ...APP_RECIPES.map(recipe => overrides.get(recipe.id) || recipe),
    ...STATE.customRecipes.filter(recipe => !getDefaultRecipe(recipe.id))
  ];
}

export function getRecipeById(id) { return getAllRecipes().find(recipe => recipe.id === id); }

export function getVisibleRecipes() {
  return getAllRecipes().filter(recipe => recipeMatchesDietPreference(recipe));
}

export function normalizeCookLabel(value) {
  const raw = cleanText(value).toLowerCase();
  const number = Number.parseInt(raw.match(/\d+/)?.[0], 10);
  if (raw.includes('parallel')) return `Cook ${normalizeProcessCount((number || 1) + 1)}`;
  if (number) return `Cook ${normalizeProcessCount(number)}`;
  return raw.includes('two') || raw.includes('second') ? 'Cook 2' : 'Cook 1';
}

export function normalizeProcessCount(value) {
  return Math.min(500, Math.max(1, Number.parseInt(value, 10) || 1));
}

export function processLabel(value) {
  const number = Number.parseInt(normalizeCookLabel(value).split(' ')[1], 10);
  return number === 1 ? 'Primary process' : `In parallel process ${number - 1}`;
}

export function recipeProcessCount(recipe) {
  const steps = Array.isArray(recipe.steps) ? recipe.steps.slice(0, 500) : [];
  return Math.max(normalizeProcessCount(recipe.cookCount), ...steps.map(step =>
    Number.parseInt(normalizeCookLabel(step?.cook || step?.assignee || step?.person).split(' ')[1], 10)));
}

export function processKeys(count) {
  return Array.from({ length: normalizeProcessCount(count) }, (_, index) => `Cook ${index + 1}`);
}

export function normalizeStepType(value) {
  const raw = cleanText(value).toLowerCase();
  return raw === "prep" ? "Prep" : "Cook";
}

export function inferStepTypeFromAction(actionText) {
  const action = cleanText(actionText).toLowerCase();
  if (!action) return "Cook";
  const prepHint = /\b(chop|slice|dice|mince|peel|wash|rinse|measure|mix|whisk|marinate|soak|prep|preheat)\b/i;
  return prepHint.test(action) ? "Prep" : "Cook";
}

export function inferStepItem(text) {
  const source = cleanText(text);
  const splitMatch = source.match(/^([^:-]{2,36})[:-]\s*(.+)$/);
  return splitMatch ? splitMatch[1].trim() : "";
}

export function normalizeStep(step, index, cookCount = 1) {
  if (!step || typeof step !== 'object') step = { text: String(step || '') };
  const item = cleanText(step.item || step.ingredient || inferStepItem(step.text)) || `Task ${index + 1}`;
  const action = cleanText(step.action || step.whatToDo || step.text) || "Prepare";
  const text = cleanText(step.text) || `${item}: ${action}`;
  const duration = Math.max(0, Math.round(toNonNegativeNumber(step.duration, 0)));
  const cook = normalizeCookLabel(step.cook || step.assignee || step.person);

  return {
    id: cleanText(step.id) || `action-${index + 1}`,
    ...(normalizeStepScaling(step.scaling) ? { scaling: normalizeStepScaling(step.scaling) } : {}),
    title: cleanText(step.title) || action.split(/[.!?]/)[0].split(/\s+/).slice(0, 8).join(' '),
    dependsOn: Array.isArray(step.dependsOn) ? step.dependsOn.map(cleanText) : [],
    attention: step.attention === 'passive' ? 'passive' : 'active',
    item,
    action,
    actionType: step.actionType == null ? inferActionType(action) : normalizeActionType(step.actionType),
    duration,
    stepType: normalizeStepType(step.stepType || step.type || inferStepTypeFromAction(action)),
    cook: Number.parseInt(cook.split(' ')[1], 10) <= normalizeProcessCount(cookCount) ? cook : 'Cook 1',
    text
  };
}

export function deriveCookTimeFromSteps(steps, cookCount = 1) {
  return deriveRecipeTimes(steps).cookTime;
}

export function deriveRecipeTimes(steps) {
  const seconds = { Prep: 0, Cook: 0 };
  for (const step of steps) seconds[normalizeStepType(step.stepType)] += toNonNegativeNumber(step.duration);
  return { prepTime: Math.ceil(seconds.Prep / 60), cookTime: Math.ceil(seconds.Cook / 60) };
}

export function safeImageSource(value) {
  const source = cleanText(value);
  if (/^https?:\/\//i.test(source) || /^assets\/[\w./-]+$/.test(source)) return source;
  return FALLBACK_RECIPE_IMAGE;
}

export function normalizeRecipeForStorage(recipe) {
  if (!recipe || typeof recipe !== 'object') throw new Error('Invalid recipe');
  if (recipe.stepSchemaVersion === 2) validateRecipeSteps(recipe.steps);
  const cookCount = recipeProcessCount(recipe);
  const steps = Array.isArray(recipe.steps)
    ? recipe.steps.slice(0, 500).map((step, index) => {
      const normalized = normalizeStep(step, index, cookCount);
      if (recipe.stepSchemaVersion !== 2) {
        normalized.id = `action-${index + 1}`;
        normalized.dependsOn = index ? [`action-${index}`] : [];
        normalized.attention = 'active';
      }
      return normalized;
    })
    : [];

  return retainPortionSource({
    stepSchemaVersion: recipe.stepSchemaVersion === 2 ? 2 : 1,
    ...(isPersonalRecipe(recipe) ? { baseRecipeId: recipe.id } : {}),
    ...(recipe.imageCredit ? { imageCredit: cleanText(recipe.imageCredit).slice(0, 2000) } : {}),
    ...(recipe.sources ? { sources: normalizeRecipeSources(recipe.sources) } : {}),
    ...(typeof recipe.searchAttribution === 'string' && recipe.searchAttribution ? { searchAttribution: recipe.searchAttribution.slice(0, 50000) } : {}),
    id: cleanText(recipe.id).slice(0, 200) || crypto.randomUUID(),
    title: cleanText(recipe.title).slice(0, 200) || 'Untitled Recipe',
    description: cleanText(recipe.description).slice(0, 10000),
    category: ['Breakfast', 'Lunch', 'Dinner'].includes(recipe.category) ? recipe.category : 'Dinner',
    difficulty: ['Easy', 'Medium', 'Hard'].includes(recipe.difficulty) ? recipe.difficulty : 'Medium',
    servings: Math.max(1, Math.round(toNonNegativeNumber(recipe.servings, 2))),
    cookCount,
    image: safeImageSource(recipe.image),
    rating: toNonNegativeNumber(recipe.rating, 4.7),
    ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients.filter(i => i && i.name).slice(0, 500).map(i => ({
      name: cleanText(i.name).slice(0, 200), amount: toNonNegativeNumber(i.amount), unit: cleanText(i.unit || 'pcs'),
      ...(Number.isFinite(i.gramsPerPiece) && i.gramsPerPiece > 0 ? { gramsPerPiece: i.gramsPerPiece, pieceLabel: cleanText(i.pieceLabel).slice(0, 100) } : {})
    })) : [],
    tags: Array.isArray(recipe.tags) && recipe.tags.length ? recipe.tags.map(tag => cleanText(tag)).slice(0, 30) : ["Custom"],
    steps,
    ...deriveRecipeTimes(steps)
  }, recipe);
}

export function normalizeStepScaling(value) {
  if (!value || !['fixed', 'quantity', 'batch'].includes(value.mode)) return null;
  const result = { mode: value.mode };
  if (value.mode === 'batch' && typeof value.group === 'string') result.group = value.group.slice(0, 100);
  if (typeof value.aliasOf === 'string') result.aliasOf = value.aliasOf.slice(0, 200);
  if (value.mode === 'batch') {
    if (![value.yield, value.capacity, value.secondsPerBatch].every(n => Number.isFinite(n) && n > 0)) return null;
    Object.assign(result, { yield: value.yield, capacity: value.capacity, secondsPerBatch: value.secondsPerBatch, yieldLabel: cleanText(value.yieldLabel).slice(0, 100) });
  }
  if (Array.isArray(value.ingredients)) result.ingredients = value.ingredients.filter(i => Number.isInteger(i) && i >= 0 && i < 500).slice(0, 500);
  if (typeof value.template === 'string' && Array.isArray(value.quantities)) {
    const references = value.quantities.slice(0, 100).map(ref => ({
      ...(Number.isInteger(ref?.ingredient) && ref.ingredient >= 0 && ref.ingredient < 500 ? { ingredient: ref.ingredient } : { amount: toNonNegativeNumber(ref?.amount) }),
      ...(Number.isFinite(ref?.fraction) && ref.fraction >= 0 ? { fraction: ref.fraction } : {}),
      ...(typeof ref?.unit === 'string' ? { unit: cleanText(ref.unit).slice(0, 30) } : {})
    }));
    if ([...value.template.matchAll(/\{(\d+)\}/g)].every(match => Number(match[1]) < references.length)) {
      result.template = value.template.slice(0, 10000);
      result.quantities = references;
    }
  }
  return result;
}

export function validateRecipeSteps(steps) {
  if (!Array.isArray(steps) || !steps.length || steps.length > 500) throw new Error('Use between 1 and 500 actions.');
  const byId = new Map();
  for (const step of steps) {
    if (!step || typeof step.id !== 'string' || !step.id.trim() || step.id !== step.id.trim()) throw new Error('Every action needs a unique ID.');
    if (byId.has(step.id)) throw new Error(`Duplicate action ID: ${step.id}`);
    if (typeof step.title !== 'string' || !step.title.trim() || typeof step.action !== 'string' || !step.action.trim()) throw new Error('Every action needs a brief title and an instruction.');
    if (typeof step.duration !== 'number' || !Number.isFinite(step.duration) || step.duration < 1) throw new Error(`${step.title}: duration must be at least one second.`);
    if (!['active', 'passive'].includes(step.attention)) throw new Error(`${step.title}: choose hands-on or unattended.`);
    if (!Array.isArray(step.dependsOn) || step.dependsOn.some(id => typeof id !== 'string')) throw new Error(`${step.title}: invalid prerequisites.`);
    byId.set(step.id, step);
  }
  const visiting = new Set(), visited = new Set();
  function visit(id) {
    if (visiting.has(id)) throw new Error('Action dependencies contain a cycle.');
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id).dependsOn) {
      if (dependency === id) throw new Error('An action cannot depend on itself.');
      if (!byId.has(dependency)) throw new Error(`Missing prerequisite: ${dependency}`);
      visit(dependency);
    }
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of byId.keys()) visit(id);
  return true;
}

// Warn about distinct commands, without treating ingredient lists as commands.
export function hasCombinedCommands(action) {
  const verb = '(?:rinse|drain|chop|slice|dice|mince|peel|heat|add|pour|transfer|remove|stir|mix|fold|serve|garnish|flip|cook|simmer|cover|steam|toast|blend|whisk|season|turn|sprinkle|finish|mash|boil|reserve|cut|spread|top|drizzle)';
  return new RegExp(`(?:[.;]\\s*|\\b(?:then|meanwhile|and)\\s+)${verb}\\b`, 'i').test(action);
}

export function formatDurationLabel(seconds) {
  const total = Math.max(0, Math.round(seconds || 0));
  if (total <= 0) return "No timer";

  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  if (minutes === 0) return `${secs}s`;
  if (secs === 0) return `${minutes}m`;
  return `${minutes}m ${secs}s`;
}
