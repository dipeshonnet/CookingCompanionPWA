import { formatQuantity } from './utils.js';
import { convertQuantity } from './units.js';

export function normalizePortions(value) {
  const count = Number(value);
  return Number.isSafeInteger(count) && count > 0 ? count : 1;
}

export function formatPortionQuantity(value) {
  const number = Number(value);
  const whole = Math.floor(number);
  const fraction = number - whole;
  const fractions = [[0.125, '⅛'], [0.25, '¼'], [1 / 3, '⅓'], [0.5, '½'], [2 / 3, '⅔'], [0.75, '¾']];
  const match = fractions.find(([part]) => Math.abs(part - fraction) < 0.00001);
  if (match) return `${whole || ''}${match[1]}`;
  if (number > 0 && number < 0.01) return Number(number.toPrecision(2)).toString();
  return formatQuantity(number);
}

export function formatIngredientAmount(ingredient, amount = ingredient.amount) {
  const unit = ingredient.unit || 'pcs';
  const units = { pc: ['piece', 'pieces'], pcs: ['piece', 'pieces'], cups: ['cup', 'cups'], cup: ['cup', 'cups'],
    cloves: ['clove', 'cloves'], slices: ['slice', 'slices'] };
  const label = units[unit] ? units[unit][amount <= 1 ? 0 : 1] : unit;
  const pieceCount = amount / ingredient.gramsPerPiece;
  const pieceLabel = pieceCount <= 1 ? (ingredient.pieceLabel || 'medium pieces').replace(/potatoes$/, 'potato').replace(/pieces$/, 'piece') : ingredient.pieceLabel || 'medium pieces';
  const equivalent = ingredient.gramsPerPiece && unit === 'g'
    ? ` (about ${formatPortionQuantity(pieceCount)} ${pieceLabel})` : '';
  return `${formatPortionQuantity(amount)} ${label}${equivalent}`;
}

export function normalizeMealSelection(value) {
  const recipeId = typeof value === 'string' ? value : value?.recipeId;
  return typeof recipeId === 'string' && recipeId ? { recipeId, portions: normalizePortions(value?.portions) } : null;
}

const sources = new WeakMap();

export function retainPortionSource(copy, recipe) {
  if (sources.has(recipe)) sources.set(copy, sources.get(recipe));
  return copy;
}

// Always scale from the source, never from a previous on-screen selection.
export function scaleRecipeForPortions(recipe, selected = 1) {
  const source = sources.get(recipe) || recipe;
  const portions = normalizePortions(selected);
  const servings = Math.max(1, Number(source.servings) || 1);
  const factor = portions / servings;
  const result = structuredClone(source);
  result.servings = portions;
  result.portions = portions;
  const ingredients = source.ingredients || [];
  const steps = source.steps || [];
  result.ingredients = ingredients.map(ingredient => ({ ...ingredient, amount: ingredient.amount * factor }));
  result.timingIsOriginal = steps.some(step => !step.scaling);
  result.steps = steps.map(step => {
    const rule = step.scaling;
    let duration = step.duration;
    if (rule?.mode === 'quantity') duration *= factor;
    if (rule?.mode === 'batch' && !rule.group) {
      const capacity = rule.capacity;
      const batches = Math.max(1, Math.ceil(rule.yield * factor / capacity - 1e-9));
      duration = batches * rule.secondsPerBatch;
    }
    let action = step.action;
    if (rule?.template) {
      action = rule.template.replace(/\{(\d+)\}/g, (_, index) => {
        const reference = rule.quantities[Number(index)];
        const ingredient = ingredients[reference.ingredient];
        const value = reference.ingredient == null ? reference.amount : ingredient?.amount;
        const amount = (Number(value) || 0) * (reference.fraction ?? 1) * factor;
        return formatPortionQuantity(reference.unit && ingredient ? convertQuantity(amount, ingredient.unit, reference.unit) ?? amount : amount);
      });
    }
    const used = rule?.ingredients?.map(index => result.ingredients[index]).filter(Boolean) || [];
    if (used.length) action += ` Ingredients for this action: ${used.map(ingredient => `${formatIngredientAmount(ingredient)} ${ingredient.name.toLowerCase()}`).join(', ')}.`;
    if (rule?.mode === 'batch' && !rule.group) {
      const batches = Math.max(1, Math.ceil(rule.yield * factor / rule.capacity - 1e-9));
      action += ` Prepare ${formatPortionQuantity(rule.yield * factor)} ${rule.yieldLabel || 'pieces'} in ${batches} ${batches === 1 ? 'batch' : 'batches'}; allow ${formatQuantity(rule.secondsPerBatch / 60)} minutes per batch.`;
    }
    return { ...structuredClone(step), duration: Math.max(rule ? 1 : 0, Math.round(duration)), action, text: action };
  });
  // Repeat multi-phase batches as complete cycles (sear/flip/sear, not all
  // first sides followed by all second sides). Dependencies serialize the pan.
  const aliases = new Map(steps.filter(step => step.scaling?.aliasOf && steps.some(target => target.id === step.scaling.aliasOf && target.scaling?.group)).map(step => [step.id, step.scaling.aliasOf]));
  result.steps = result.steps.filter(step => !aliases.has(step.id));
  const groups = new Map();
  for (const step of result.steps) if (step.scaling?.group) {
    const group = groups.get(step.scaling.group) || [];
    group.push(step);
    groups.set(step.scaling.group, group);
  }
  const finalIds = new Map(), expanded = new Map();
  for (const [name, steps] of groups) {
    const rule = steps[0].scaling;
    const count = Math.max(1, Math.ceil(rule.yield * factor / rule.capacity - 1e-9));
    if (count * steps.length + result.steps.length - steps.length > 500) throw new Error('These portions need too many cooking actions. Please cook in smaller groups.');
    const members = new Set(steps.map(step => step.id));
    const idFor = (id, batch) => batch === 0 ? id : `${id}-batch-${batch + 1}`;
    for (const step of steps) finalIds.set(step.id, idFor(step.id, count - 1));
    const copies = [];
    for (let batch = 0; batch < count; batch++) for (const [index, step] of steps.entries()) {
      const dependsOn = step.dependsOn.map(id => members.has(id) ? idFor(id, batch) : id);
      if (batch && index === 0) dependsOn.push(idFor(steps.at(-1).id, batch - 1));
      copies.push({ ...step, id: idFor(step.id, batch), dependsOn, duration: Math.max(1, Math.round(step.scaling.secondsPerBatch)),
        title: `${step.title} · batch ${batch + 1}/${count}`,
        action: `${step.action} Batch ${batch + 1} of ${count}; use at most ${formatPortionQuantity(rule.capacity)} ${rule.yieldLabel || 'recipe quantities'} per batch.` });
    }
    expanded.set(name, copies);
  }
  const emitted = new Set();
  result.steps = result.steps.flatMap(step => {
    if (step.scaling?.group) {
      if (emitted.has(step.scaling.group)) return [];
      emitted.add(step.scaling.group);
      return expanded.get(step.scaling.group);
    }
    return [{ ...step, dependsOn: [...new Set(step.dependsOn.map(id => finalIds.get(aliases.get(id) || id) || aliases.get(id) || id))] }];
  }).map(step => ({ ...step, text: step.action }));
  const minutes = type => Math.ceil(result.steps.filter(step => step.stepType === type).reduce((sum, step) => sum + step.duration, 0) / 60);
  result.prepTime = minutes('Prep');
  result.cookTime = minutes('Cook');
  sources.set(result, source);
  return result;
}
