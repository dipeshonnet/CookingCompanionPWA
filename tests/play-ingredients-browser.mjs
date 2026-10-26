import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright');
const server = spawn(process.execPath, ['tools/dev-server.mjs'], { env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
let browser, count = 0;
const check = (label, value) => { assert.ok(value, label); console.log(`PASS ${label}`); count++; };
try {
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Test server did not start')), 10000);
    server.stdout.on('data', data => { const match = String(data).match(/http:\/\/localhost:\d+\//); if (match) { clearTimeout(timer); resolve(match[0]); } });
    server.on('error', reject);
  });
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('#btn-login-local').click();
  await page.locator('[data-view="play"]').click();
  check('an unselected recipe explains how to show ingredients', await page.locator('#play-ingredients-empty').isVisible() && (await page.locator('#play-ingredients-empty').innerText()).includes('Choose a recipe'));
  const recipes = await page.evaluate(async () => (await import('/modules/recipe-domain.js')).getVisibleRecipes());
  for (const recipe of recipes) {
    await page.locator('#play-recipe-select').selectOption(recipe.id);
    for (const portions of [1, 4]) {
      await page.locator('#play-portions').fill(String(portions));
      await page.locator('#play-portions').dispatchEvent('change');
      const expected = await page.evaluate(async ({ recipe, portions }) => {
        const { formatIngredientAmount } = await import('/modules/recipe-portions.js');
        return recipe.ingredients.map(ing => `${formatIngredientAmount(ing, ing.amount * portions / recipe.servings)} ${ing.name}`);
      }, { recipe, portions });
      assert.deepEqual(await page.locator('#play-portion-ingredients li').allTextContents(), expected, `${recipe.title}: ${portions} portions`);
      assert.ok(await page.locator('#play-portion-ingredients li').first().isVisible(), `${recipe.title} ingredients are visible`);
    }
  }
  check(`all ${recipes.length} built-in recipes show visible ingredients at one and four portions`, true);
  await page.locator('.play-ingredients summary').click();
  await page.locator('#play-recipe-select').selectOption('handpicked-poha');
  check('selecting another recipe opens its ingredient list', await page.locator('#play-portion-ingredients li').first().isVisible());
  await page.evaluate(async () => {
    const { STATE, RUNTIME } = await import('/modules/state.js');
    STATE.user.mutePlayAudio = true; STATE.user.playStepVideo = false;
    RUNTIME.playSession.ingredients = [];
    (await import('/modules/play-recipe.js')).renderPlayBoards();
  });
  check('an empty inactive snapshot cannot hide recipe ingredients', await page.locator('#play-portion-ingredients li').count() === 11);
  await page.locator('#play-portions').fill('2');
  await page.locator('#play-portions').dispatchEvent('change');
  await page.locator('#play-recipe-start-btn').click();
  const frozen = await page.locator('#play-portion-ingredients li').allTextContents();
  await page.evaluate(async () => {
    const { STATE, RUNTIME } = await import('/modules/state.js');
    clearInterval(RUNTIME.playSession.intervalId); RUNTIME.playSession.intervalId = null;
    const source = (await import('/modules/recipe-domain.js')).getRecipeById('handpicked-poha');
    STATE.customRecipes.push({ ...source, baseRecipeId: source.id, ingredients: [{ name: 'Changed ingredient', amount: 100, unit: 'g' }] });
    (await import('/modules/play-recipe.js')).renderPlayBoards();
  });
  assert.deepEqual(await page.locator('#play-portion-ingredients li').allTextContents(), frozen);
  check('active cooking retains frozen ingredient quantities after recipe edits', true);
  await page.evaluate(async () => {
    const { STATE, RUNTIME } = await import('/modules/state.js');
    STATE.customRecipes = [];
    RUNTIME.playSession.ingredients = [];
    (await import('/modules/play-recipe.js')).renderPlayBoards();
  });
  check('empty legacy cooking ingredients fall back to the scaled recipe', (await page.locator('#play-portion-ingredients li').first().innerText()) === '2 cups Thick poha (flattened rice)');
  await page.locator('#play-recipe-reset-btn').click();
  await page.evaluate(async () => {
    const { STATE } = await import('/modules/state.js');
    const source = (await import('/modules/recipe-domain.js')).getRecipeById('handpicked-poha');
    STATE.customRecipes.push({ ...source, id: 'custom-ingredients', ingredients: [{ name: 'Custom rice', amount: 300, unit: 'g' }], servings: 3 });
    STATE.customRecipes.push({ ...source, id: 'empty-ingredients', ingredients: [] });
    (await import('/modules/play-recipe.js')).renderPlayRecipeView();
  });
  await page.locator('#play-recipe-select').selectOption('custom-ingredients');
  check('custom recipes use their own scaled ingredient list', await page.locator('#play-portion-ingredients').innerText() === '100 g Custom rice');
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    check(`ingredients remain visible at ${width}px`, await page.locator('#play-portion-ingredients li').first().isVisible());
  }
  await mkdir('output/playwright', { recursive: true });
  await page.locator('#play-recipe-select').selectOption('handpicked-poha');
  await page.locator('.play-ingredients').screenshot({ path: 'output/playwright/play-ingredients-mobile.png' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('.play-ingredients').screenshot({ path: 'output/playwright/play-ingredients-desktop.png' });
  await page.locator('#play-recipe-select').selectOption('empty-ingredients');
  check('recipes without ingredients explain the empty list', await page.locator('#play-ingredients-empty').isVisible() && (await page.locator('#play-ingredients-empty').innerText()).includes('No ingredients'));
  check('no uncaught browser errors', errors.length === 0);
  console.log(`${count} ingredient browser checks passed.`);
} finally { await browser?.close(); server.kill(); }
