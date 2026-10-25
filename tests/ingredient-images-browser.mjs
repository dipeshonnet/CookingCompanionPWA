import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright');
const server = spawn(process.execPath, ['tools/dev-server.mjs'], { env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
let browser;
let checks = 0;
const check = (name, result) => { assert.ok(result, name); checks++; console.log(`PASS ${name}`); };
try {
  const url = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Server did not start')), 10000);
    server.stdout.on('data', data => { const match = String(data).match(/http:\/\/localhost:\d+\//); if (match) { clearTimeout(timeout); resolve(match[0]); } });
    server.on('error', reject);
  });
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  await page.goto(url);
  await page.locator('#btn-login-local').click();
  await page.locator('[data-view="pantry"]').click();
  await page.locator('#pantry-ingredient-input').fill('Tomato');
  await page.locator('#pantry-add-btn').click();
  await page.waitForFunction(() => document.querySelector('#pantry-manager-tags img')?.naturalWidth === 144);
  check('adding an ingredient immediately shows its photo', (await page.locator('#pantry-manager-tags img').getAttribute('src')).endsWith('/tomato.webp'));
  await page.evaluate(async () => {
    const { COMMON_INGREDIENTS } = await import('/modules/ingredient-catalogue.js');
    const { STATE } = await import('/modules/state.js');
    STATE.user.dietPreference = 'None';
    STATE.pantry = Object.entries(COMMON_INGREDIENTS).flatMap(([category, names]) => names.map(name => ({ id: name, name, category, quantity: 1, unit: 'pcs' })));
    (await import('/modules/ingredients.js')).renderPantryView();
  });
  const loaded = await page.evaluate(async () => {
    const images = [...document.querySelectorAll('#pantry-manager-tags img')];
    for (const image of images) image.loading = 'eager';
    await Promise.all(images.map(image => image.decode()));
    return images.length === 156 && images.every(image => image.naturalWidth === 144 && image.naturalHeight === 144 && image.src.startsWith(location.origin));
  });
  check('all 156 photos load locally at a consistent size', loaded);
  await mkdir('output/playwright', { recursive: true });
  await page.screenshot({ path: 'output/playwright/ingredient-photos-desktop.png', animations: 'disabled', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'output/playwright/ingredient-photos-mobile.png', animations: 'disabled', fullPage: true });
  check('156 ingredient tags fit the mobile viewport', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  check('ingredient names remain readable on mobile', await page.evaluate(() => {
    const first = document.querySelector('#pantry-manager-tags .ingredient-name-with-photo > span').getBoundingClientRect();
    const tags = [...document.querySelectorAll('#pantry-manager-tags .pantry-tag')];
    return first.height < 30 && tags.every(tag => tag.getBoundingClientRect().right <= innerWidth);
  }));
  await page.setViewportSize({ width: 1440, height: 1000 });
  check('dashboard uses ingredient photos', await page.evaluate(async () => {
    (await import('/modules/navigation.js')).switchView('dashboard');
    return document.querySelectorAll('#dashboard-pantry-list img.ingredient-thumbnail').length === 8;
  }));
  check('AI ingredient selector uses ingredient photos', await page.evaluate(async () => {
    (await import('/modules/navigation.js')).switchView('ai-generator');
    return document.querySelectorAll('#ai-selectable-ingredients img.ingredient-thumbnail').length === 156;
  }));
  await page.locator('.recipe-ingredient-name').first().fill('aubergine');
  check('recipe editor recognizes aliases and updates the photo', (await page.locator('.recipe-ingredient-row img').first().getAttribute('src')).endsWith('/brinjal.webp'));
  check('recipe details use a photo for every ingredient', await page.evaluate(async () => {
    const { HANDPICKED_RECIPES } = await import('/recipes.js');
    (await import('/modules/recipe-detail.js')).showRecipeDetailsModal(HANDPICKED_RECIPES[0]);
    return document.querySelectorAll('#modal-ingredients img.ingredient-thumbnail').length === HANDPICKED_RECIPES[0].ingredients.length;
  }));
  await page.evaluate(() => { document.getElementById('recipe-modal').style.display = 'none'; });
  check('shopping list shows matching photos', await page.evaluate(async () => {
    const { STATE } = await import('/modules/state.js');
    STATE.pantry = [];
    STATE.scheduledMeals = { 'Monday-Dinner': 'handpicked-poha' };
    (await import('/modules/navigation.js')).switchView('planner');
    const rows = [...document.querySelectorAll('#planner-shopping-list .ingredient-item')];
    return rows.length > 0 && rows.every(row => row.querySelector('img.ingredient-thumbnail'));
  }));
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);
  check('every photo remains available offline', await page.evaluate(async () => {
    const { COMMON_INGREDIENTS } = await import('/modules/ingredient-catalogue.js');
    const { ingredientImageSource } = await import('/modules/ingredient-images.js');
    return (await Promise.all(Object.values(COMMON_INGREDIENTS).flat().map(async name => {
      const response = await fetch(ingredientImageSource(name));
      return response.ok && response.headers.get('content-type') === 'image/webp';
    }))).every(Boolean);
  }));
  check('no uncaught browser errors', errors.length === 0);
  console.log(`${checks} ingredient photo browser checks passed.`);
} finally {
  await browser?.close();
  server.kill();
}
