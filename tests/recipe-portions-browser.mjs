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
  await page.evaluate(async () => {
    const { STATE } = await import('/modules/state.js');
    STATE.user.experience = 'Expert'; STATE.user.mutePlayAudio = true; STATE.user.playStepVideo = false;
    (await import('/modules/recipe-detail.js')).showRecipeDetailsModal((await import('/modules/recipe-domain.js')).getRecipeById('handpicked-upma'));
  });
  check('details default to one person and explain portions', await page.locator('#modal-servings').inputValue() === '1' && (await page.locator('#modal-portions-hint').innerText()).includes('1 person'));
  check('one-person water and onion quantities appear in instructions', (await page.locator('#modal-steps').innerText()).includes('1¼ cups of water') && (await page.locator('#modal-ingredients').innerText()).includes('½ piece'));
  const onePrep = await page.locator('#modal-prep').innerText();
  const oneTimeline = await page.locator('#modal-recipe-timeline .timeline-estimate').innerText();
  await page.locator('#modal-servings').fill('4');
  await page.locator('#modal-servings').dispatchEvent('change');
  check('four-person quantities, preparation and elapsed schedule refresh together', (await page.locator('#modal-steps').innerText()).includes('5 cups of water') && onePrep !== await page.locator('#modal-prep').innerText() && oneTimeline !== await page.locator('#modal-recipe-timeline .timeline-estimate').innerText());
  await page.locator('#modal-cook-count').selectOption('2');
  await page.locator('#modal-servings-inc').click();
  check('changing portions retains selected cooks', await page.locator('#modal-cook-count').inputValue() === '2' && await page.locator('#modal-servings').inputValue() === '5');
  await page.locator('#modal-servings').fill('0');
  await page.locator('#modal-servings').dispatchEvent('change');
  check('invalid counts reset to one and cannot decrement below one', await page.locator('#modal-servings').inputValue() === '1' && await page.locator('#modal-servings-dec').isDisabled());
  await page.locator('#modal-servings').fill('4');
  await page.locator('#modal-servings').dispatchEvent('change');
  const expected = await page.evaluate(async () => (await import('/modules/state.js')).RUNTIME.activeModalRecipe.steps[0].duration);
  await page.locator('#modal-btn-start-parallel-timers').click();
  check('guided cooking carries portions and locks the count', await page.locator('#play-portions').inputValue() === '4' && await page.locator('#play-portions').isDisabled());
  check('guided cooking uses the scaled instructions and duration once', await page.evaluate(async expected => {
    const { RUNTIME } = await import('/modules/state.js');
    clearInterval(RUNTIME.playSession.intervalId); RUNTIME.playSession.intervalId = null;
    return RUNTIME.playSession.portions === 4 && RUNTIME.playSession.running['Cook 1'].duration === expected && RUNTIME.playSession.ingredients.find(i => i.name === 'Water').amount === 5;
  }, expected));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-view="play"]').click();
  check('reload restores the selected portions and frozen ingredients', await page.locator('#play-portions').inputValue() === '4' && (await page.locator('#play-portion-ingredients').textContent()).includes('5 cups Water'));
  await page.locator('#play-recipe-reset-btn').click();
  await page.locator('#play-recipe-select').selectOption('handpicked-upma');
  check('fresh Play Recipe selections default to one', await page.locator('#play-portions').inputValue() === '1' && !(await page.locator('#play-portions').isDisabled()));
  await page.locator('[data-portion-target="play-portions"][data-portion-delta="1"]').click();
  check('Play Recipe previews ingredients for selected diners', (await page.locator('#play-portion-ingredients').textContent()).includes('2½ cups Water'));
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    const name = (await caches.keys()).find(name => name.startsWith('cooking-companion-shell-'));
    const cache = await caches.open(name);
    await cache.put('/styles.css', new Response('.portion-control { display: block; }', { headers: { 'Content-Type': 'text/css' } }));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-view="play"]').click();
  for (const width of [1440, 900, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    check(`Play portions stay horizontal with stale cached CSS at ${width}px`, await page.locator('#play-portions').evaluate(input => {
      const [minus, , plus] = [...input.parentElement.children].map(element => element.getBoundingClientRect());
      const field = input.getBoundingClientRect();
      return Math.abs(minus.top - plus.top) < 1 && Math.abs(field.top - minus.top) < 4 && minus.right <= field.left && field.right <= plus.left && plus.right <= innerWidth;
    }));
  }
  await mkdir('output/playwright', { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'output/playwright/play-portions-desktop.png', fullPage: true });
  await page.evaluate(async () => {
    const { STATE } = await import('/modules/state.js');
    STATE.pantry = []; STATE.scheduledMeals = { 'Monday-Breakfast': 'handpicked-upma' };
    (await import('/modules/storage.js')).saveStateToStorage();
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-view="planner"]').click();
  check('legacy planned meals migrate to one person', await page.evaluate(async () => {
    const { STATE } = await import('/modules/state.js');
    return STATE.scheduledMeals['Monday-Breakfast'].portions === 1 && document.getElementById('meal-planner-week-grid').textContent.includes('1 person');
  }));
  const monday = page.locator('.planner-day-card').first().locator('.planner-slot').first();
  await monday.locator('button').click();
  check('editing a planned meal restores portions', await page.locator('#schedule-portions').inputValue() === '1');
  await page.locator('#schedule-portions').fill('4');
  await page.locator('#btn-select-meal-save').click();
  const tuesday = page.locator('.planner-day-card').nth(1).locator('.planner-slot').first();
  await tuesday.locator('button').click();
  check('new planned meals default to one', await page.locator('#schedule-portions').inputValue() === '1');
  await page.locator('#select-meal-recipe-dropdown').selectOption('handpicked-upma');
  await page.locator('#btn-select-meal-save').click();
  check('shopping sums separate occurrences using their portions', await page.evaluate(async () => {
    const { STATE } = await import('/modules/state.js');
    const onion = [...document.querySelectorAll('#planner-shopping-list li')].find(row => row.textContent.includes('Onion'));
    return STATE.scheduledMeals['Monday-Breakfast'].portions === 4 && STATE.scheduledMeals['Tuesday-Breakfast'].portions === 1 && onion.textContent.includes('2½ pieces');
  }));
  await page.evaluate(async () => {
    const { STATE } = await import('/modules/state.js');
    STATE.user.dietPreference = 'Keto';
    (await import('/modules/planner.js')).renderPlannerView();
  });
  check('diet changes do not remove assigned meals from shopping', (await page.locator('#planner-shopping-list').innerText()).includes('Onion'));
  await page.evaluate(async () => {
    const { STATE } = await import('/modules/state.js'); STATE.user.dietPreference = 'None';
    STATE.pantry = [{ id: 'onion', name: 'Onion', unit: 'pcs', quantity: 3 }];
    (await import('/modules/recipe-detail.js')).showRecipeDetailsModal((await import('/modules/recipe-domain.js')).getRecipeById('handpicked-upma'), 4);
  });
  await page.locator('#modal-btn-cook').click();
  await page.locator('input[name="cook-pantry-mode"][value="deduct"]').check();
  await page.locator('#cook-meal-confirm-btn').click();
  check('pantry deduction uses selected portions exactly once', await page.evaluate(async () => (await import('/modules/state.js')).STATE.pantry.find(i => i.name === 'Onion').quantity === 1));
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(async () => {
      (await import('/modules/recipe-detail.js')).showRecipeDetailsModal((await import('/modules/recipe-domain.js')).getRecipeById('veg-masala-dosa'));
    });
    await page.locator('#modal-servings-inc').click();
    check(`portion controls fit and work at ${width}px`, await page.locator('#modal-servings').inputValue() === '2' && await page.locator('#modal-servings').evaluate(input => input.getBoundingClientRect().right <= innerWidth));
  }
  await mkdir('output/playwright', { recursive: true });
  await page.evaluate(() => { document.getElementById('cook-meal-toast').hidden = true; });
  await page.screenshot({ path: 'output/playwright/recipe-portions-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(async () => {
    (await import('/modules/recipe-detail.js')).showRecipeDetailsModal((await import('/modules/recipe-domain.js')).getRecipeById('r5'));
  });
  await page.locator('#modal-btn-edit-recipe').click();
  await page.locator('.recipe-step-title').nth(10).fill('Pour my special second batch');
  await page.locator('#recipe-save-btn').click();
  check('editing a previously combined batch preserves the saved action sequence', await page.evaluate(async () => {
    const recipe = (await import('/modules/recipe-domain.js')).getRecipeById('r5');
    const scaled = (await import('/modules/recipe-portions.js')).scaleRecipeForPortions(recipe, 1);
    return scaled.steps.some(step => step.title === 'Pour my special second batch') && scaled.timingIsOriginal;
  }));
  check('no uncaught browser errors', errors.length === 0);
  console.log(`${count} portion browser checks passed.`);
} finally { await browser?.close(); server.kill(); }
