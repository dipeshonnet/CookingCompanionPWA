import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright');
const server = spawn(process.execPath, ['tools/dev-server.mjs'], { env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
let browser;
try {
  const url = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Server startup timeout')), 10000);
    server.stdout.on('data', data => { const match = String(data).match(/http:\/\/localhost:\d+\//); if (match) { clearTimeout(timeout); resolve(match[0]); } });
    server.on('error', reject);
  });
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install({ time: new Date('2026-10-27T12:00:00') });
  await page.goto(url);
  await page.locator('#btn-login-local').click();
  await page.locator('.nav-item[data-view="planner"]').click();
  assert.equal(await page.locator('#planner-week-date').inputValue(), '2026-10-26');
  assert.equal(await page.locator('.planner-day-past').count(), 1);
  assert.equal(await page.locator('.planner-day-today').count(), 1);
  assert.equal(await page.locator('.planner-slot button').count(), 21);
  await page.locator('[data-planner-week="1"]').click();
  assert.equal(await page.locator('#planner-week-date').inputValue(), '2026-11-02');
  await page.locator('.planner-day-card').first().locator('.planner-slot button').first().click();
  assert.match(await page.locator('#schedule-meal-context').innerText(), /Breakfast/);
  await page.locator('#select-meal-recipe-dropdown').selectOption('handpicked-upma');
  await page.locator('#schedule-portions').fill('3');
  await page.evaluate(async () => (await import('/modules/planner.js')).saveScheduledMealSelection());
  assert.equal(await page.evaluate(async () => (await import('/modules/state.js')).STATE.scheduledMeals['2026-11-02-Breakfast'].portions), 3);
  await page.locator('[data-planner-week="today"]').click();
  assert.ok(!(await page.locator('.planner-day-card').first().innerText()).includes('Upma'));
  assert.ok((await page.locator('#planner-shopping-list').innerText()).includes('Semolina'));
  const list = await page.locator('#planner-shopping-list').innerText();
  await page.evaluate(async () => {
    const { STATE } = await import('/modules/state.js');
    STATE.scheduledMeals['2026-10-26-Breakfast'] = { recipeId: 'handpicked-upma', portions: 10 };
    STATE.scheduledMeals['2026-10-27-Breakfast'] = { recipeId: 'handpicked-upma', portions: 10 };
    (await import('/modules/planner.js')).renderPlannerView();
  });
  assert.equal(await page.locator('#planner-shopping-list').innerText(), list);
  await page.reload();
  await page.locator('.nav-item[data-view="planner"]').click();
  assert.equal(await page.locator('#planner-week-date').inputValue(), '2026-10-26');
  await page.locator('[data-planner-week="1"]').click();
  assert.ok((await page.locator('.planner-day-card').first().innerText()).includes('3 people'));
  await mkdir('output/playwright', { recursive: true });
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const geometry = await page.evaluate(() => {
      const grid = document.getElementById('meal-planner-week-grid');
      const rows = [...document.querySelectorAll('.planner-day-card')].map(day => [...day.querySelectorAll('.planner-slot')].map(slot => slot.getBoundingClientRect().top));
      const view = document.getElementById('view-planner').getBoundingClientRect();
      return { rows, pageFits: view.left >= 0 && view.right <= innerWidth, scrolls: grid.scrollWidth > grid.clientWidth, gridWidth: grid.clientWidth };
    });
    assert.ok(geometry.pageFits, `page fits at ${width}`);
    assert.ok(geometry.gridWidth > 100);
    assert.ok(geometry.rows.every(row => row.every((top, index) => Math.abs(top - geometry.rows[0][index]) < 1)), 'meal rows align across days');
    if (width < 500) assert.ok(geometry.scrolls);
    await page.locator('#meal-planner-week-grid').evaluate(grid => { grid.scrollLeft = grid.scrollWidth; });
    await page.locator('#view-planner').screenshot({ path: `output/playwright/planner-calendar-${width}.png` });
  }
  assert.deepEqual(errors, []);
  console.log('PASS current week, dated editing, grey past days, future-only shopping, reload persistence, aligned desktop/mobile calendar');
} finally { await browser?.close(); server.kill(); }
