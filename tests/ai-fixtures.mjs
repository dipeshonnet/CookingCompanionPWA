export const recipeSearchSources = [{ url: 'https://recipes.example.com/rice', title: 'Rice recipe' }];
export const recipeSearchNotes = 'Rice recipe: rinse 100 g rice, add 200 ml water, simmer covered for 10 minutes. Chop 1 tomato independently; serve with rice. Source: [Rice recipe](https://recipes.example.com/rice)';

export function recipeSearchCompletion(provider) {
  if (provider === 'openai') return { status: 'completed', output: [
    { type: 'web_search_call', status: 'completed' },
    { type: 'message', content: [{ type: 'output_text', text: recipeSearchNotes, annotations: [{ type: 'url_citation', ...recipeSearchSources[0] }] }] }
  ] };
  if (provider === 'gemini') return { candidates: [{ finishReason: 'STOP', content: { parts: [{ thought: true, text: 'Ignore reasoning' }, { text: recipeSearchNotes }] }, groundingMetadata: {
    groundingChunks: [{ web: { uri: recipeSearchSources[0].url, title: recipeSearchSources[0].title } }], webSearchQueries: ['rice recipe'], searchEntryPoint: { renderedContent: '<div>Search suggestions</div>' }
  } }] };
  return { choices: [{ finish_reason: 'stop', message: { content: recipeSearchNotes } }] };
}

const step = (id, title, duration, dependsOn, actionType, attention = 'active', cook = 'Cook 1', stepType = 'Cook') => ({ id, title, item: id === 'tomato' ? 'Tomato' : 'Rice', action: `${title}.`, text: `${title}.`, duration, dependsOn, actionType, attention, cook, stepType });
export const draftRecipeFixture = {
  stepSchemaVersion: 2, title: 'Rice with tomato', description: 'A simple rice dinner.', category: 'Dinner', difficulty: 'Easy', prepTime: 2, cookTime: 11, servings: 2, tags: ['Vegan'],
  ingredients: [{ name: 'Rice', amount: 100, unit: 'g' }, { name: 'Water', amount: 200, unit: 'ml' }, { name: 'Tomato', amount: 1, unit: 'pcs' }],
  steps: [
    step('rinse', 'Rinse rice', 30, [], 'Other', 'active', 'Cook 1', 'Prep'),
    step('water', 'Add water to rice', 10, ['rinse'], 'Other'),
    step('cover', 'Cover rice pot', 5, ['water'], 'Other'),
    step('simmer', 'Simmer covered rice', 600, ['cover'], 'Simmer', 'passive'),
    step('tomato', 'Chop tomato', 60, [], 'Chop', 'active', 'Cook 2', 'Prep'),
    step('serve', 'Serve rice with tomato', 20, ['simmer', 'tomato'], 'Serve')
  ]
};
