const UNITS = {
  g: ['mass', 1], kg: ['mass', 1000], mg: ['mass', 0.001],
  ml: ['volume', 1], l: ['volume', 1000], cup: ['volume', 240],
  tbsp: ['volume', 15], tsp: ['volume', 5]
};

export function canonicalUnit(unit) {
  const text = String(unit || 'pcs').trim().toLowerCase();
  const aliases = { cups: 'cup', tablespoons: 'tbsp', teaspoons: 'tsp', grams: 'g', kilograms: 'kg', pieces: 'pcs', piece: 'pcs', cloves: 'clove', slices: 'slice' };
  return aliases[text] || text;
}

export function convertQuantity(amount, from, to) {
  from = canonicalUnit(from);
  to = canonicalUnit(to);
  if (from === to) return Number(amount);
  const a = UNITS[from];
  const b = UNITS[to];
  return a && b && a[0] === b[0] ? Number(amount) * a[1] / b[1] : null;
}

export function findPantryMatch(pantry, ingredient) {
  const name = String(ingredient.name).trim().toLowerCase();
  return pantry.find(item => item.name.trim().toLowerCase() === name && convertQuantity(item.quantity, item.unit, ingredient.unit) !== null);
}

export function availableQuantity(pantry, ingredient) {
  const item = findPantryMatch(pantry, ingredient);
  return item ? convertQuantity(item.quantity, item.unit, ingredient.unit) : 0;
}

export function buildShoppingList(recipes, pantry) {
  const grouped = new Map();
  for (const recipe of recipes) {
    for (const ingredient of recipe.ingredients) {
      const name = ingredient.name.trim().toLowerCase();
      const existing = [...grouped.values()].find(item => item.name.trim().toLowerCase() === name && convertQuantity(ingredient.amount, ingredient.unit, item.unit) !== null);
      if (existing) existing.amount += convertQuantity(ingredient.amount, ingredient.unit, existing.unit);
      else grouped.set(`${name}:${canonicalUnit(ingredient.unit)}`, { ...ingredient });
    }
  }
  return [...grouped.values()].map(item => ({ ...item, amount: Math.max(0, item.amount - availableQuantity(pantry, item)) })).filter(item => item.amount > 0.001);
}
