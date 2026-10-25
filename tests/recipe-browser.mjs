import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright');
const server = spawn(process.execPath, ['tools/dev-server.mjs'], { env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
let browser;
let passed = 0;
const check = (label, condition) => { assert.ok(condition, label); passed++; console.log(`PASS ${label}`); };
try {
  const url = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Test server did not start')), 10000);
    server.stdout.on('data', data => { const match = String(data).match(/http:\/\/localhost:\d+\//); if (match) { clearTimeout(timeout); resolve(match[0]); } });
    server.on('error', reject);
  });
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [], dialogs = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => { dialogs.push(dialog.message()); dialog.accept(); });
  await page.goto(url);
  await page.locator('#btn-login-local').click();
  await page.evaluate(async () => {
    const { STATE } = await import('/modules/state.js');
    STATE.user.mutePlayAudio = true;
    STATE.user.playStepVideo = false;
    STATE.user.experience = 'Expert';
    const poha = (await import('/recipes.js')).APP_RECIPES[0];
    (await import('/modules/recipe-detail.js')).showRecipeDetailsModal(poha);
  });
  check('details show action titles and all Gantt bars', await page.locator('#modal-steps .step-card-num').first().innerText() === 'Rinse poha' && await page.locator('#modal-recipe-timeline .timeline-bar').count() === 26);
  check('details include dependency arrows', await page.locator('#modal-recipe-timeline .timeline-links > path').count() > 20);
  const oneEstimate = await page.locator('#modal-recipe-timeline .recipe-timeline-header').innerText();
  await page.locator('#modal-cook-count').selectOption('2');
  check('changing preview cooks updates elapsed estimate', oneEstimate !== await page.locator('#modal-recipe-timeline .recipe-timeline-header').innerText());
  const timeline = page.locator('#modal-recipe-timeline');
  await timeline.locator('[data-timeline-action="rinse"]').focus();
  await page.keyboard.press('Enter');
  check('Gantt bars expose action details with keyboard', (await timeline.locator('.timeline-selection').innerText()).includes('Prerequisites: None'));
  await page.locator('#modal-btn-start-parallel-timers').click();
  check('guided action opens player with selected cook count', await page.locator('#view-play').isVisible() && await page.locator('#play-cook-count').inputValue() === '2');
  check('two cooks receive distinct ready hands-on actions', (await page.locator('#play-col-cook1').innerText()).includes('Rinse poha') && (await page.locator('#play-col-cook2').innerText()).includes('Chop onion'));
  await page.locator('#play-cook-count').selectOption('1');
  check('busy cook retirement is explained', (await page.locator('#play-cook-status').innerText()).includes('after their current action'));
  await page.evaluate(async () => {
    const { RUNTIME } = await import('/modules/state.js');
    RUNTIME.playSession.running['Cook 2'].deadline = Date.now() - 1;
    (await import('/modules/play-recipe.js')).runPlayRecipeTick();
  });
  check('retired cook receives no new work', await page.locator('#play-col-cook2').count() === 0);
  await page.locator('#play-cook-count').selectOption('2');
  check('adding a cook starts ready work immediately', await page.locator('#play-col-cook2 .play-step-card').count() === 1);
  await page.locator('#play-recipe-reset-btn').click();
  check('reset clears recipe, passive actions and returns to one cook', await page.locator('#play-cook-count').inputValue() === '1' && await page.locator('#play-col-unattended .play-step-card').count() === 0);
  await page.locator('#play-recipe-select').selectOption('handpicked-poha');
  await page.locator('#play-recipe-start-btn').click();
  const expireCook1 = () => page.evaluate(async () => {
    const { RUNTIME } = await import('/modules/state.js');
    RUNTIME.playSession.running['Cook 1'].deadline = Date.now() - 1;
    (await import('/modules/play-recipe.js')).runPlayRecipeTick();
  });
  await expireCook1();
  check('rinse completion starts drain', (await page.locator('#play-col-cook1').innerText()).includes('Drain poha'));
  await expireCook1();
  check('one cook chops while poha softens unattended', (await page.locator('#play-col-cook1').innerText()).includes('Chop onion') && (await page.locator('#play-col-unattended').innerText()).includes('Soften poha'));
  check('floating timers include hands-on and unattended actions', await page.locator('.floating-timer-row').count() === 2 && (await page.locator('#floating-active-timers').innerText()).includes('Unattended'));
  check('blocked actions name unfinished prerequisites', (await page.locator('#play-col-upcoming').innerText()).includes('Waiting for:') && (await page.locator('#play-col-upcoming').innerText()).includes('Soften poha'));
  await page.locator('#play-recipe-timeline summary').click();
  await page.evaluate(() => { const el = document.querySelector('#play-recipe-timeline .timeline-scroll'); el.scrollTop = 140; el.focus(); });
  await page.waitForTimeout(1300);
  check('live timeline preserves expanded dependencies, scrolling and keyboard focus', await page.evaluate(() => document.querySelector('#play-recipe-timeline details').open && document.querySelector('#play-recipe-timeline .timeline-scroll').scrollTop === 140 && document.activeElement.classList.contains('timeline-scroll')));
  await mkdir('output/playwright', { recursive: true });
  await page.screenshot({ path: 'output/playwright/recipe-dependencies-desktop.png', fullPage: true });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.waitForTimeout(400);
    check(`player timeline stays contained at ${width}px`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  await page.screenshot({ path: 'output/playwright/recipe-dependencies-mobile.png', fullPage: true });
  await page.locator('#play-recipe-reset-btn').click();
  // Graph validation through the actual editor, including referenced deletions.
  await page.evaluate(async () => (await import('/modules/navigation.js')).switchView('ai-generator'));
  await page.locator('.recipe-step-title').first().fill('Chop onion');
  await page.locator('.recipe-step-action').first().fill('Chop onion and slice chilli.');
  check('editor flags combined actions', (await page.locator('.recipe-step-warning').first().innerText()).includes('several commands'));
  await page.locator('.recipe-step-action').first().fill('Chop onion.');
  await page.locator('#recipe-add-step-row').click();
  await page.locator('.recipe-step-title').nth(1).fill('Sauté onion');
  check('new editor actions default to the previous prerequisite', await page.locator('.recipe-step-dependencies').nth(1).locator('option:checked').innerText() === 'Chop onion');
  await page.locator('[data-remove-step-row]').first().click();
  check('referenced actions cannot be deleted', await page.locator('.recipe-step-row').count() === 2 && dialogs.at(-1).includes('Update prerequisites'));
  await page.locator('.recipe-step-dependencies').nth(1).selectOption([]);
  await page.locator('[data-remove-step-row]').first().click();
  check('clearing dependencies permits deletion', await page.locator('.recipe-step-row').count() === 1);
  await page.locator('#recipe-reset-form').click();
  // Invalid imports must fail atomically without replacing existing recipes.
  const valid = await page.evaluate(async () => structuredClone((await import('/recipes.js')).APP_RECIPES[0]));
  valid.id = 'invalid-cycle';
  valid.steps[0].dependsOn = [valid.steps.at(-1).id];
  const importDialog = page.waitForEvent('dialog');
  await page.locator('#recipe-import-file').setInputFiles({ name: 'cycle.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ recipes: [valid] })) });
  const importError = await importDialog;
  check('cyclic imports are rejected without saving', importError.message().includes('cycle') && await page.evaluate(async () => !(await import('/modules/state.js')).STATE.customRecipes.some(r => r.id === 'invalid-cycle')));
  check('no uncaught browser errors', errors.length === 0);
  console.log(`${passed} recipe dependency browser checks passed.`);
} finally { await browser?.close(); server.kill(); }
