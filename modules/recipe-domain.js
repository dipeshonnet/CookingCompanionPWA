import { STATE, FALLBACK_RECIPE_IMAGE } from './state.js';
import { cleanText, toNonNegativeNumber } from './utils.js';
import { APP_RECIPES } from '../recipes.js';

export function recipeMatchesDietPreference(recipe, preference = STATE.user.dietPreference || "None") {
  if (!preference || preference === "None") return true;
  const tags = (recipe.tags || []).map(tag => cleanText(tag).toLowerCase());
  const pref = cleanText(preference).toLowerCase();

  if (pref === "vegetarian") return tags.includes("vegetarian") || tags.includes("vegan");
  if (pref === "low-carb") return tags.includes("low-carb") || tags.includes("keto");
  if (pref === "keto") return tags.includes("keto");
  return tags.includes(pref);
}

// Get all recipe lists combined (curated + custom recipes)
export function getAllRecipes() {
  return [...APP_RECIPES, ...STATE.customRecipes];
}

export function getVisibleRecipes() {
  return getAllRecipes().filter(recipe => recipeMatchesDietPreference(recipe));
}

export function normalizeCookLabel(value) {
  const raw = cleanText(value).toLowerCase();
  return raw.includes("2") || raw.includes("two") || raw.includes("second") ? "Cook 2" : "Cook 1";
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

  return {
    item,
    action,
    duration,
    stepType: normalizeStepType(step.stepType || step.type || inferStepTypeFromAction(action)),
    cook: cookCount === 2 ? normalizeCookLabel(step.cook || step.assignee || step.person) : "Cook 1",
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
  const cookCount = Number.parseInt(recipe.cookCount, 10) === 2 ? 2 : 1;
  const steps = Array.isArray(recipe.steps)
    ? recipe.steps.slice(0, 500).map((step, index) => normalizeStep(step, index, cookCount))
    : [];

  return {
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
      name: cleanText(i.name).slice(0, 200), amount: toNonNegativeNumber(i.amount), unit: cleanText(i.unit || 'pcs')
    })) : [],
    tags: Array.isArray(recipe.tags) && recipe.tags.length ? recipe.tags.map(tag => cleanText(tag)).slice(0, 30) : ["Custom"],
    steps,
    ...deriveRecipeTimes(steps)
  };
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
