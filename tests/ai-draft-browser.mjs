import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { draftRecipeFixture, recipeSearchCompletion, recipeSearchSources } from './ai-fixtures.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright');
const server = spawn(process.execPath, ['tools/dev-server.mjs'], { env: { ...process.env, PORT: '0' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let browser, checks = 0;
const check = (label, value) => { assert.ok(value, label); checks++; console.log(`PASS ${label}`); };
try {
  const url = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Server did not start')), 10000);
    server.stdout.on('data', data => { const match = String(data).match(/http:\/\/localhost:\d+\//); if (match) { clearTimeout(timeout); resolve(match[0]); } });
    server.on('error', reject);
  });
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [], dialogs = [], requests = [];
  page.on('pageerror', error => { errors.push(error.message); console.error('Browser error:', error.message); });
  page.on('dialog', dialog => { dialogs.push(dialog.message()); dialog.accept(); });
  let mode = 'okay', releaseSearch;
  await page.route(/^https:\/\/(api\.openai\.com|api\.groq\.com|generativelanguage\.googleapis\.com)\//, async route => {
    const request = route.request(), body = request.postDataJSON();
    const provider = request.url().includes('api.openai.com') ? 'openai' : request.url().includes('api.groq.com') ? 'groq' : 'gemini';
    requests.push({ provider, body });
    if (body.tools && mode === 'pause') await new Promise(resolve => { releaseSearch = resolve; });
    if (body.tools && mode === 'searchFail') { await route.fulfill({ status: 429, contentType: 'application/json', body: '{}' }); return; }
    let result;
    if (body.tools) result = recipeSearchCompletion(provider);
    else {
      const draft = structuredClone(draftRecipeFixture);
      draft.title = provider + ' rice dinner';
      if (mode === 'badDraft') draft.steps[0].text = 'Rinse rice and chop tomato.';
      result = provider === 'gemini' ? { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(draft) }] } }] } : { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(draft) } }] };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) });
  });
  await page.goto(url);
  await page.locator('#btn-login-local').click();
  await page.locator('[data-view="ai-generator"]').click();
  await page.locator('#view-ai-generator summary').filter({ hasText: 'Create with AI' }).click();
  check('description replaces pantry selection', await page.locator('#ai-recipe-description').isVisible() && await page.locator('#ai-selectable-ingredients').count() === 0);
  await page.locator('#ai-generate-btn').click();
  check('blank description stays focused and makes no request', requests.length === 0 && await page.locator('#ai-recipe-description').evaluate(element => element === document.activeElement));
  await page.locator('#ai-recipe-description').fill('A mild rice dinner for two');
  await page.locator('#ai-cook-count').fill('2');
  await page.locator('#ai-available-cooks').selectOption('2');
  await page.evaluate(async () => { const { STATE } = await import('/modules/state.js'); STATE.pantry = []; STATE.user.dietPreference = 'Vegan'; });
  await mkdir('output/playwright', { recursive: true });
  await page.locator('.ai-controls').screenshot({ path: 'output/playwright/ai-draft-description-desktop.png' });
  for (const provider of ['openai', 'gemini', 'groq']) {
    await page.locator('#ai-provider-select').selectOption(provider);
    await page.locator('#ai-key-input').fill(provider + '-test-key');
    await page.locator('#ai-key-save-btn').click();
    mode = 'pause';
    releaseSearch = undefined;
    const before = requests.length;
    await page.locator('#ai-generate-btn').click();
    await page.waitForFunction(() => document.getElementById('ai-loader').style.display === 'flex');
    check(provider + ' shows search status and disables duplicate generation', await page.locator('#ai-generate-btn').isDisabled() && (await page.locator('#ai-loader-title').innerText()).includes('Searching'));
    while (!releaseSearch) await new Promise(resolve => setTimeout(resolve, 10));
    mode = 'okay';
    releaseSearch();
    await page.locator('#ai-result-panel').waitFor({ state: 'visible' });
    check(provider + ' searches and drafts with the existing provider and empty pantry', requests.length === before + 2 && requests.slice(before).every(item => item.provider === provider));
    check(provider + ' sends the description and profile dietary preference to search', JSON.stringify(requests[before].body).includes('A mild rice dinner for two') && JSON.stringify(requests[before].body).includes('Vegan'));
    check(provider + ' displays sources, action tags, prerequisites, and the cooking timeline', await page.locator('#ai-recipe-body .recipe-sources a').getAttribute('href') === recipeSearchSources[0].url && (await page.locator('#ai-recipe-body').innerText()).includes('Chop') && (await page.locator('#ai-recipe-body').innerText()).includes('Unattended') && await page.locator('#ai-recipe-timeline .timeline-bar').count() === 6 && await page.locator('#ai-recipe-body .step-prerequisites').count() === 6);
    check(provider + ' starts with the requested two-cook preview', await page.locator('#ai-preview-cook-count').inputValue() === '2');
    await page.locator('#ai-preview-cook-count').selectOption('1');
    check(provider + ' preview can switch to one cook', !(await page.locator('#ai-recipe-timeline').innerText()).includes('Cook 2'));
    if (provider === 'gemini') check('Google Search suggestions are displayed in an isolated frame', await page.locator('#ai-recipe-body iframe').getAttribute('sandbox') === 'allow-popups allow-popups-to-escape-sandbox');
    await page.locator('#ai-save-recipe-btn').click();
    check(provider + ' saves source links and action metadata', await page.evaluate(async () => {
      const { STATE } = await import('/modules/state.js');
      const saved = STATE.customRecipes[0];
      return saved.sources?.length === 1 && saved.steps.find(step => step.id === 'tomato').actionType === 'Chop' && saved.steps.find(step => step.id === 'serve').dependsOn.length === 2 && saved.rating === 0;
    }));
  }
  await page.locator('#ai-result-panel').screenshot({ path: 'output/playwright/ai-draft-plan-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#ai-result-panel').screenshot({ path: 'output/playwright/ai-draft-plan-mobile.png' });
  const mobileWidth = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, overflow: [...document.querySelectorAll('#view-ai-generator *')].filter(element => element.getBoundingClientRect().right > innerWidth && !element.closest('.timeline-scroll')).slice(0, 12).map(element => [element.tagName, element.id, element.className, element.getBoundingClientRect().width]) }));
  if (mobileWidth.scroll > mobileWidth.width + 1) console.log(JSON.stringify(mobileWidth));
  check('draft and timeline fit the mobile viewport', mobileWidth.scroll <= mobileWidth.width + 1);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(async () => { const { STATE } = await import('/modules/state.js'); (await import('/modules/recipe-detail.js')).showRecipeDetailsModal(STATE.customRecipes[0]); });
  check('saved recipe details retain clickable references', await page.locator('#modal-recipe-sources a').getAttribute('href') === recipeSearchSources[0].url);
  await page.evaluate(async () => { const { STATE } = await import('/modules/state.js'); (await import('/modules/recipe-builder.js')).editRecipe(STATE.customRecipes[0].id); });
  await page.locator('#recipe-save-btn').click();
  check('editing a saved AI recipe preserves references', await page.evaluate(async () => (await import('/modules/state.js')).STATE.customRecipes[0].sources.length === 1));
  mode = 'searchFail';
  const beforeFailure = requests.length;
  await page.locator('#ai-generate-btn').click();
  await page.waitForFunction(() => !document.getElementById('ai-generate-btn').disabled);
  check('search failure does not draft, restores controls, and clears stale results', requests.length === beforeFailure + 1 && dialogs.at(-1).includes('rate limit or quota') && !(await page.locator('#ai-result-panel').isVisible()) && await page.evaluate(async () => (await import('/modules/state.js')).RUNTIME.lastGeneratedRecipeObj === null));
  mode = 'badDraft';
  await page.locator('#ai-generate-btn').click();
  await page.waitForFunction(() => !document.getElementById('ai-generate-btn').disabled);
  check('combined commands in detailed text cannot be saved as a draft', dialogs.at(-1).includes('combine multiple actions') && !(await page.locator('#ai-result-panel').isVisible()));
  mode = 'pause';
  releaseSearch = undefined;
  const beforeSwitch = requests.length;
  await page.locator('#ai-generate-btn').click();
  while (!releaseSearch) await new Promise(resolve => setTimeout(resolve, 10));
  await page.locator('#ai-provider-select').selectOption('gemini');
  mode = 'okay';
  releaseSearch();
  await page.waitForFunction(() => !document.getElementById('ai-generate-btn').disabled);
  check('switching provider during search prevents stale drafting', requests.length === beforeSwitch + 1 && !(await page.locator('#ai-result-panel').isVisible()));
  check('no uncaught browser errors', errors.length === 0);
  console.log(`${checks} AI draft browser checks passed.`);
} finally {
  await browser?.close();
  server.kill();
}
