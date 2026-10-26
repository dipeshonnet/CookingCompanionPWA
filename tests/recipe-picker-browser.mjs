import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright');
const server = spawn(process.execPath, ['tools/dev-server.mjs'], { env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
let browser;
try {
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Server did not start')), 10000);
    server.on('error', reject);
    server.stdout.on('data', data => {
      const match = String(data).match(/http:\/\/localhost:\d+\//);
      if (match) { clearTimeout(timer); resolve(match[0]); }
    });
  });
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  await page.locator('#btn-login-local').click();
  await page.locator('[data-view="play"]').click();
  const search = page.getByRole('combobox', { name: 'Choose Recipe' });
  const options = page.locator('#play-recipe-options');
  const selection = page.locator('#play-recipe-select');
  await search.click();
  assert.ok(await options.getByRole('option').count() > 10);
  await page.locator('#play-cook-count').selectOption('2');
  await search.fill('uPmA');
  assert.ok((await options.getByRole('option').allTextContents()).every(text => /upma/i.test(text)));
  await search.press('ArrowDown');
  assert.ok(await search.getAttribute('aria-activedescendant'));
  const expected = await options.locator('.is-active').textContent();
  await search.press('Enter');
  assert.equal(await search.inputValue(), expected);
  assert.ok(await selection.inputValue());
  assert.equal(await page.locator('#play-cook-count').inputValue(), '2');
  assert.ok(await page.locator('#play-portion-ingredients li').count() > 0);
  assert.equal(await search.getAttribute('aria-expanded'), 'false');
  console.log('PASS typeahead matches case-insensitively; keyboard selection updates ingredients and preserves cooks');

  await search.fill('no recipe has this name');
  assert.equal(await options.getByRole('option').count(), 0);
  assert.ok(await options.getByRole('status').isVisible());
  assert.equal(await selection.inputValue(), '');
  assert.ok(await page.locator('#play-recipe-start-btn').isDisabled());
  await search.press('Enter');
  assert.equal(await selection.inputValue(), '');
  await search.press('Escape');
  assert.equal(await search.getAttribute('aria-expanded'), 'false');
  console.log('PASS unmatched searches cannot play a stale recipe and Escape closes suggestions');

  await mkdir('output/playwright', { recursive: true });
  for (const width of [1440, 900, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await search.fill('poha');
    const bounds = await options.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
    await page.screenshot({ path: `output/playwright/recipe-picker-${width}.png` });
    const match = options.getByRole('option', { name: 'Poha', exact: true });
    await match.click();
    assert.equal(await selection.inputValue(), 'handpicked-poha');
    assert.equal(await search.inputValue(), 'Poha');
  }
  console.log('PASS suggestion menus fit and click selection works from 320px to 1440px');
  await page.evaluate(async () => {
    const { STATE } = await import('/modules/state.js');
    STATE.user.mutePlayAudio = true;
    STATE.user.playStepVideo = false;
  });
  await page.locator('#play-recipe-start-btn').click();
  assert.ok(await search.isDisabled());
  await page.locator('#play-recipe-reset-btn').click();
  assert.ok(await search.isEnabled());
  assert.equal(await search.inputValue(), '');
  await search.fill('upma');
  await search.press('Enter');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('[data-view="dashboard"]').click();
  await page.locator('[data-view="play"]').click();
  assert.match(await search.inputValue(), /upma/i);
  assert.deepEqual(errors, []);
  console.log('PASS cooking locks the search, Reset clears it, navigation preserves the selection; no browser errors');
} finally { await browser?.close(); server.kill(); }
