import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright');
const server = spawn(process.execPath, ['tools/dev-server.mjs'], { env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
let browser;
let passed = 0;
const check = (label, condition) => { assert.ok(condition, label); console.log(`PASS ${label}`); passed++; };

try {
  const url = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Test server did not start')), 10000);
    server.stdout.on('data', data => {
      const match = String(data).match(/http:\/\/localhost:\d+\//);
      if (match) { clearTimeout(timeout); resolve(match[0]); }
    });
    server.on('error', error => { clearTimeout(timeout); reject(error); });
  });
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.dismiss());
  await page.goto(url);
  await page.locator('#btn-login-local').click();
  const widget = page.locator('#floating-active-timers');
  check('floating timer hidden when idle', await widget.isHidden());
  await page.evaluate(async () => {
    const { STATE } = await import('/modules/state.js');
    STATE.user.mutePlayAudio = true;
    STATE.user.playStepVideo = false;
    STATE.customRecipes = [{ id: 'timer-test', title: 'Garden Vegetable Soup with Rice and Fresh Herbs', category: 'Dinner', cookCount: 2,
      steps: [
        { item: 'Chopped garden vegetables and fresh tomatoes', action: 'Simmer in the pot', cook: 'Cook 1', stepType: 'Cook', duration: 120 },
        { item: 'Rice', action: 'Boil in a saucepan', cook: 'Cook 2', stepType: 'Cook', duration: 180 },
        { item: 'Basil', action: 'Stir into the soup', cook: 'Cook 1', stepType: 'Cook', duration: 60 }
      ] }];
  });
  const startRecipe = async () => {
    await page.evaluate(async () => (await import('/modules/navigation.js')).switchView('play'));
    await page.locator('#play-recipe-select').selectOption('timer-test');
    await page.locator('#play-recipe-start-btn').click();
  };
  await startRecipe();
  check('parallel cooks appear in floating timers', await widget.isVisible() && await widget.locator('.floating-timer-row').count() === 2);
  await page.evaluate(async () => {
    window.originalFloatingClock = document.querySelector('#floating-active-timers [data-timer-clock]');
    window.originalInterval = (await import('/modules/state.js')).RUNTIME.playSession.intervalId;
  });
  for (const view of ['dashboard', 'pantry', 'ai-generator', 'planner', 'faq', 'play']) {
    await page.locator(`[data-view="${view}"]`).click();
    check(`floating timer visible on ${view}`, await widget.isVisible());
  }
  await page.locator('[data-view="dashboard"]').click();
  check('dashboard includes Play Recipe timers', await page.locator('#active-timers-container .timer-item').count() === 2);
  await page.locator('[data-view="faq"]').click();
  await widget.focus();
  await widget.press('Enter');
  check('keyboard shortcut returns to Play Recipe without restarting', await page.locator('#view-play').isVisible() && await page.evaluate(async () => (await import('/modules/state.js')).RUNTIME.playSession.intervalId === window.originalInterval));
  await page.evaluate(async () => {
    const { RUNTIME } = await import('/modules/state.js');
    RUNTIME.playSession.running['Cook 1'].deadline = Date.now() + 5000;
    RUNTIME.playSession.running['Cook 2'].deadline = Date.now() + 9000;
    (await import('/modules/play-recipe.js')).runPlayRecipeTick();
  });
  check('both live countdowns update', await widget.locator('[data-timer-clock]').nth(0).innerText() === '00:05' && await widget.locator('[data-timer-clock]').nth(1).innerText() === '00:09');
  check('countdown updates preserve timer elements', await page.evaluate(() => window.originalFloatingClock === document.querySelector('#floating-active-timers [data-timer-clock]')));
  await page.evaluate(async () => {
    const { RUNTIME } = await import('/modules/state.js');
    for (const step of Object.values(RUNTIME.playSession.running)) step.deadline = Date.now() + 60000;
    (await import('/modules/play-recipe.js')).runPlayRecipeTick();
  });
  await page.locator('[data-view="pantry"]').click();
  await mkdir('output/playwright', { recursive: true });
  await page.screenshot({ path: 'output/playwright/floating-timers-desktop.png', fullPage: true, animations: 'disabled' });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.waitForFunction(() => parseFloat(getComputedStyle(document.querySelector('.main-content')).marginLeft) === 0 && document.getElementById('sidebar-nav').getBoundingClientRect().right <= 1);
    const rect = await widget.boundingBox();
    const layout = await page.evaluate(() => ({ viewport: innerWidth, scroll: document.documentElement.scrollWidth,
      overflow: [...document.querySelectorAll('body *')].filter(element => element.getBoundingClientRect().right > innerWidth + 1 && getComputedStyle(element).display !== 'none').slice(0, 8).map(element => ({ id: element.id, class: element.className, right: element.getBoundingClientRect().right })) }));
    if (!(rect.x >= 0 && rect.x + rect.width <= width && rect.y + rect.height <= 844 && layout.scroll <= layout.viewport)) {
      console.log(JSON.stringify({ rect, layout }));
      await page.screenshot({ path: `output/playwright/floating-timers-overflow-${width}.png`, fullPage: true });
    }
    check(`floating timer fits ${width}px mobile`, rect.x >= 0 && rect.x + rect.width <= width && rect.y + rect.height <= 844 && layout.scroll <= layout.viewport);
  }
  await page.screenshot({ path: 'output/playwright/floating-timers-mobile.png', fullPage: true, animations: 'disabled' });
  await widget.click();
  check('mobile tap returns to Play Recipe', await page.locator('#view-play').isVisible());
  await page.evaluate(async () => {
    const { RUNTIME } = await import('/modules/state.js');
    for (const step of Object.values(RUNTIME.playSession.running)) step.deadline = Date.now() - 1;
    (await import('/modules/play-recipe.js')).runPlayRecipeTick();
  });
  check('next step replaces completed cook countdown', await widget.locator('.floating-timer-row').count() === 1 && (await widget.innerText()).includes('Basil'));
  await page.evaluate(async () => {
    const { RUNTIME } = await import('/modules/state.js');
    RUNTIME.playSession.running['Cook 1'].deadline = Date.now() - 1;
    (await import('/modules/play-recipe.js')).runPlayRecipeTick();
  });
  check('finished recipe hides floating timers', await widget.isHidden());
  await startRecipe();
  await page.locator('#play-recipe-reset-btn').click();
  check('reset hides floating timers', await widget.isHidden());
  await page.evaluate(async () => {
    (await import('/modules/timers.js')).startCookingTimer('Tea', 0, 120, 'Cook 2', 'Steep tea', { silent: true });
  });
  check('individual timers also appear in floating control', await widget.isVisible() && (await widget.innerText()).includes('Steep tea'));
  await startRecipe();
  check('playing and individual timers coexist', await widget.locator('.floating-timer-row').count() === 3);
  await page.locator('#play-recipe-reset-btn').click();
  check('recipe reset retains individual timers', await widget.locator('.floating-timer-row').count() === 1);
  await widget.click();
  await page.evaluate(async () => (await import('/modules/navigation.js')).switchView('dashboard'));
  await page.locator('#active-timers-container button[aria-label="Cancel timer"]').click();
  check('cancelling last individual timer hides control', await widget.isHidden());
  await startRecipe();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('#btn-logout').click();
  check('sign-out hides timers and clears reserved space', await widget.isHidden() && await page.evaluate(() => !document.body.classList.contains('has-floating-timers')));
  check('no uncaught browser errors', errors.length === 0);
  console.log(`${passed} active timer browser checks passed.`);
} finally {
  await browser?.close();
  server.kill();
}
