import test from 'node:test';
import assert from 'node:assert/strict';
import { COMMON_INGREDIENTS, ingredientSuggestions } from '../modules/ingredient-catalogue.js';

test('every ingredient category has local prefix suggestions, isolated by category', () => {
  for (const [category, names] of Object.entries(COMMON_INGREDIENTS)) {
    assert.ok(names.length >= 10);
    assert.ok(ingredientSuggestions(category, names[0].slice(0, 2)).includes(names[0]));
  }
  assert.deepEqual(ingredientSuggestions('Fruits', 'Tur'), []);
  assert.deepEqual(ingredientSuggestions('Masala', 'tUR'), ['Turmeric']);
  assert.deepEqual(ingredientSuggestions('Vegetables', ''), []);
  assert.deepEqual(ingredientSuggestions('Vegetables', 'Tomato'), []);
  assert.deepEqual(ingredientSuggestions('Vegetables', 'Unlisted ingredient'), []);
});

test('saved ingredients and common recipe ingredients populate and rank suggestions', () => {
  const pantry = [{ name: 'Garden tomato', category: 'Vegetables' }, { name: 'Garden fruit', category: 'Fruits' }];
  const recipes = [{ ingredients: [{ name: 'Tomatoes' }, { name: 'Tomatoes' }, { name: 'Turmeric' }, { name: 'Garden greens', category: 'Vegetables' }] }];
  assert.deepEqual(ingredientSuggestions('Vegetables', 'Gar', pantry, recipes), ['Garden greens', 'Garden tomato', 'Garlic']);
  assert.equal(ingredientSuggestions('Vegetables', 'Tom', pantry, recipes)[0], 'Tomatoes');
  assert.deepEqual(ingredientSuggestions('Vegetables', 'Tur', pantry, recipes), []);
  assert.equal(ingredientSuggestions('Masala', 'Tur', pantry, recipes).length, 1);
});
