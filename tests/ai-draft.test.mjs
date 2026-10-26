import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchCustomRecipe } from '../ai.js';
import { researchRecipe } from '../modules/recipe-research.js';
import { normalizeRecipeForStorage } from '../modules/recipe-domain.js';
import { recipeForImport } from '../modules/recipe-personalization.js';
import { normalizeRecipeSources, recipeSourcesHtml, searchAttributionHtml } from '../modules/recipe-sources.js';
import { buildRecipeSchedule } from '../modules/play-engine.js';
import { ACTION_TYPES } from '../modules/action-types.js';
import { draftRecipeFixture, recipeSearchCompletion, recipeSearchSources, recipeSearchNotes } from './ai-fixtures.mjs';

const params = { description: 'A mild rice dinner for two', dietary: 'Vegan', complexity: 'Easy & Quick', cookCount: 2, availableCooks: 2 };
const completion = (provider, recipe) => provider === 'gemini'
  ? { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(recipe) }] } }] }
  : { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(recipe) } }] };

for (const provider of ['openai', 'gemini', 'groq']) {
  test(`${provider} searches the meal request before strict drafting and retains tags and sources`, async t => {
    const calls = [], stages = [];
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      const body = JSON.parse(options.body);
      calls.push({ url, options, body });
      return { ok: true, json: async () => body.tools ? recipeSearchCompletion(provider) : completion(provider, draftRecipeFixture) };
    });
    const result = await fetchCustomRecipe('test-key', params, provider, { onProgress: stage => stages.push(stage) });
    assert.equal(calls.length, 2);
    assert.deepEqual(stages, ['drafting']);
    assert.ok(calls[0].body.tools);
    assert.equal(calls[0].body.tool_choice, provider === 'gemini' ? undefined : 'required');
    assert.equal(calls[0].body.response_format, undefined);
    assert.equal(calls[0].body.generationConfig?.responseJsonSchema, undefined);
    assert.ok(JSON.stringify(calls[0].body).includes(params.description));
    assert.ok(JSON.stringify(calls[0].body).includes(params.dietary));
    const draft = calls[1].body;
    const schema = provider === 'gemini' ? draft.generationConfig.responseJsonSchema : draft.response_format.json_schema.schema;
    const prompt = provider === 'gemini' ? draft.contents[0].parts[0].text : draft.messages[1].content;
    assert.ok(prompt.includes(JSON.stringify(recipeSearchNotes)));
    assert.ok(prompt.includes('Available people cooking: 2'));
    assert.deepEqual(schema.properties.steps.items.properties.actionType.enum, [...ACTION_TYPES, 'Other']);
    assert.deepEqual(schema.properties.steps.items.properties.cook.enum, ['Cook 1', 'Cook 2']);
    assert.ok(schema.properties.steps.items.required.includes('actionType'));
    assert.deepEqual(result.sources, recipeSearchSources);
    const stored = normalizeRecipeForStorage({ ...result, cookCount: 2 });
    assert.deepEqual(recipeForImport(JSON.parse(JSON.stringify(stored))).sources, recipeSearchSources);
    assert.equal(stored.steps.find(step => step.id === 'tomato').actionType, 'Chop');
    const one = buildRecipeSchedule(stored, { availableCooks: 1 });
    const two = buildRecipeSchedule(stored, { availableCooks: 2 });
    assert.ok(two.duration <= one.duration);
    assert.equal(two.steps.find(step => step.id === 'tomato').start, two.steps.find(step => step.id === 'rinse').start, 'two cooks can begin independent active actions together');
    const simmer = one.steps.find(step => step.id === 'simmer');
    const tomato = one.steps.find(step => step.id === 'tomato');
    assert.ok(simmer.start < tomato.end && tomato.start < simmer.end, 'passive cooking overlaps hands-on work even with one cook');
    for (const schedule of [one, two]) {
      const serve = schedule.steps.find(step => step.id === 'serve');
      assert.ok(serve.start >= schedule.steps.find(step => step.id === 'simmer').end);
      assert.ok(serve.start >= schedule.steps.find(step => step.id === 'tomato').end);
    }
  });

  test(`${provider} does not draft when live search is unavailable, unsourced, or incomplete`, async t => {
    let calls = 0;
    let response = { ok: false, status: 400 };
    t.mock.method(globalThis, 'fetch', async () => { calls++; return response; });
    await assert.rejects(() => fetchCustomRecipe('test-key', params, provider), /search is unavailable/);
    assert.equal(calls, 1);
    const data = recipeSearchCompletion(provider);
    if (provider === 'openai') data.output[1].content[0].annotations = [];
    else if (provider === 'gemini') data.candidates[0].groundingMetadata.groundingChunks = [];
    else data.choices[0].message.content = 'I know a rice recipe but have no source links.';
    response = { ok: true, json: async () => data };
    await assert.rejects(() => fetchCustomRecipe('test-key', params, provider), /usable recipe sources/);
    assert.equal(calls, 2);
    if (provider === 'openai') data.status = 'incomplete';
    else if (provider === 'gemini') data.candidates[0].finishReason = 'MAX_TOKENS';
    else data.choices[0].finish_reason = 'length';
    await assert.rejects(() => fetchCustomRecipe('test-key', params, provider), /incomplete|could not complete/);
    assert.equal(calls, 3);
  });

  test(`${provider} rejects malformed action graphs, tags, and combined instructions`, async t => {
    let recipe;
    t.mock.method(globalThis, 'fetch', async (_url, options) => ({ ok: true, json: async () => JSON.parse(options.body).tools ? recipeSearchCompletion(provider) : completion(provider, recipe) }));
    for (const [mutate, pattern] of [
      [r => { delete r.steps[0].actionType; }, /invalid recipe format/],
      [r => { r.steps[0].actionType = 'Cooking'; }, /invalid recipe format/],
      [r => { r.steps[0].cook = 'Cook 3'; }, /invalid recipe format/],
      [r => { r.steps[0].duration = 0; }, /at least one second/],
      [r => { r.steps[0].dependsOn = ['missing']; }, /Missing prerequisite/],
      [r => { r.steps[0].dependsOn = ['serve']; }, /cycle/],
      [r => { r.steps[0].action = 'Rinse rice, then drain.'; }, /combine multiple actions/],
      [r => { r.steps[0].text = 'Rinse rice and chop tomato.'; }, /combine multiple actions/],
      [r => { r.ingredients = []; }, /missing usable/],
      [r => { r.ingredients[0].amount = -1; }, /missing usable/]
    ]) {
      recipe = structuredClone(draftRecipeFixture);
      mutate(recipe);
      await assert.rejects(() => fetchCustomRecipe('test-key', params, provider), pattern);
    }
  });
}

test('description validation and changed account stop unnecessary API requests', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return { ok: true, json: async () => recipeSearchCompletion('openai') }; });
  for (const description of ['', '   ', 'a'.repeat(2001)]) await assert.rejects(() => fetchCustomRecipe('test-key', { ...params, description }, 'openai'), /Describe|2,000/);
  await assert.rejects(() => fetchCustomRecipe(' ', params, 'openai'), /API key/);
  assert.equal(calls, 0);
  assert.equal(await fetchCustomRecipe('test-key', params, 'openai', { onProgress: () => false }), null);
  assert.equal(calls, 1);
});

test('sources reject unsafe links, deduplicate and escape markup; search attribution stays isolated', () => {
  const sources = normalizeRecipeSources([
    { url: 'javascript:alert(1)' }, { url: 'https://user:password@example.com/' }, { url: 'http://example.com/' },
    { url: 'https://example.com/recipe', title: '<img src=x onerror=alert(1)>' }, { url: 'https://example.com/recipe' }, null
  ]);
  assert.equal(sources.length, 1);
  assert.ok(!recipeSourcesHtml(sources).includes('<img'));
  assert.ok(recipeSourcesHtml(sources).includes('noopener noreferrer'));
  assert.ok(searchAttributionHtml('<script>bad()</script>').includes('sandbox="allow-popups allow-popups-to-escape-sandbox"'));
  assert.ok(!searchAttributionHtml('<script>bad()</script>').includes('<script>'));
});

test('network failures and timeouts identify recipe search without exposing keys', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw new DOMException('timeout', 'TimeoutError'); });
  await assert.rejects(() => researchRecipe('groq', 'test-key', params), /Recipe search timed out/);
});
