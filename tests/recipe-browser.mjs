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
  const displayChecks = await page.evaluate(async () => {
    const { APP_RECIPES } = await import('/recipes.js');
    const { createRecipeCard } = await import('/modules/recipe-views.js');
    const idli = APP_RECIPES.find(recipe => recipe.title === 'Idli');
    const card = createRecipeCard(idli);
    const placeholder = createRecipeCard({ ...idli, image: 'assets/logo.png' });
    const { showRecipeDetailsModal } = await import('/modules/recipe-detail.js');
    showRecipeDetailsModal(idli);
    return {
      image: card.querySelector('img').getAttribute('src'),
      total: card.querySelector('.recipe-meta').textContent,
      placeholder: placeholder.querySelector('.recipe-photo-placeholder')?.textContent,
      estimate: document.querySelector('#modal-recipe-timeline .timeline-estimate strong').textContent,
      prep: document.getElementById('modal-prep').textContent,
      modalImage: document.getElementById('modal-image').getAttribute('src')
    };
  });
  check('Idli card and details use the finished-dish photo', displayChecks.image === 'assets/recipes/idli.jpg' && displayChecks.modalImage === displayChecks.image);
  check('missing dish photos show a placeholder', displayChecks.placeholder === 'Recipe photo unavailable');
  check('card total includes overnight preparation and matches timeline', displayChecks.total.includes(`Total: ${displayChecks.estimate}`) && displayChecks.estimate.startsWith('18 hr ') && displayChecks.prep.includes('hr'));
  await page.locator('#modal-image').evaluate(image => image.decode());
  check('packaged Idli photo loads successfully', await page.locator('#modal-image').evaluate(image => image.naturalWidth > 0));
  check('overnight Gantt axis uses hour labels', (await page.locator('#modal-recipe-timeline .timeline-axis-track').innerText()).includes('hr'));
  const longTimeline = await page.evaluate(async () => {
    const { renderRecipeTimeline } = await import('/modules/recipe-timeline.js');
    const { createPlaySession, advancePlaySession } = await import('/modules/play-engine.js');
    const recipe = { id: 'long-timeline', title: 'Long timeline', stepSchemaVersion: 2, steps: [
      { id: 'wait', title: 'Rest dough', action: 'Rest dough.', duration: 2 * 86400 + 3600 + 60, attention: 'passive', dependsOn: [] }
    ] };
    const session = createPlaySession(recipe);
    advancePlaySession(session, 0);
    renderRecipeTimeline('modal-recipe-timeline', recipe, { session, now: (86400 + 3600 + 60) * 1000 });
    const root = document.getElementById('modal-recipe-timeline');
    return {
      estimate: root.querySelector('.timeline-estimate').textContent,
      axis: root.querySelector('.timeline-axis-track').textContent,
      prerequisites: root.querySelector('.timeline-dependencies').textContent,
      tooltip: root.querySelector('.timeline-bar').getAttribute('aria-label')
    };
  });
  check('Gantt total, axis, tooltips and prerequisites use day/hour/minute labels', longTimeline.estimate.includes('2 days 1 hr 1 min') && longTimeline.axis.includes('day') && longTimeline.axis.startsWith('0 min') && longTimeline.prerequisites.includes('0 min–2 days 1 hr 1 min') && longTimeline.tooltip.includes('0 min to 2 days 1 hr 1 min'));
  check('Gantt live elapsed time uses unit labels', longTimeline.estimate.includes('Elapsed: 1 day 1 hr 1 min'));
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
  await timeline.locator('[data-timeline-action="drain"]').click();
  check('selection highlights the action and its prerequisites', await timeline.locator('[data-timeline-action="drain"]').getAttribute('aria-pressed') === 'true' && await timeline.locator('[data-timeline-row="rinse"]').evaluate(row => row.classList.contains('prerequisite')) && await timeline.locator('.timeline-links > path.highlighted').count() > 0);
  const overviewWidth = await timeline.locator('.timeline-canvas').evaluate(canvas => canvas.offsetWidth);
  await timeline.locator('[data-timeline-zoom="detail"]').click();
  check('detail scale gives short actions more space', await timeline.locator('.timeline-canvas').evaluate(canvas => canvas.offsetWidth) > overviewWidth);
  const labelLeft = await timeline.locator('.timeline-action-label').first().evaluate(label => label.getBoundingClientRect().left);
  await timeline.locator('.timeline-scroll').evaluate(scroll => { scroll.scrollLeft = 280; });
  check('action labels stay frozen while the time grid scrolls', Math.abs(await timeline.locator('.timeline-action-label').first().evaluate(label => label.getBoundingClientRect().left) - labelLeft) < 1);
  await timeline.locator('[data-timeline-zoom="overview"]').click();
  await timeline.locator('.timeline-scroll').evaluate(scroll => { scroll.scrollLeft = 0; });
  await mkdir('output/playwright', { recursive: true });
  await timeline.screenshot({ path: 'output/playwright/gantt-preview-desktop.png' });
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
  await page.locator('#play-recipe-select').selectOption('handpicked-poha', { force: true });
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
  const liveTimeline = page.locator('#play-recipe-timeline');
  await liveTimeline.locator('[data-timeline-action="soften"]').click();
  await liveTimeline.locator('[data-timeline-zoom="detail"]').click();
  await page.waitForTimeout(1300);
  check('live updates retain selected action, scale and scale-button focus', await liveTimeline.locator('[data-timeline-action="soften"]').getAttribute('aria-pressed') === 'true' && await liveTimeline.getAttribute('data-timeline-zoom') === 'detail' && await page.evaluate(() => document.activeElement.dataset.timelineZoom === 'detail'));
  await liveTimeline.locator('[data-timeline-zoom="overview"]').click();
  await mkdir('output/playwright', { recursive: true });
  await page.screenshot({ path: 'output/playwright/recipe-dependencies-desktop.png', fullPage: true });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.waitForTimeout(400);
    check(`player timeline stays contained at ${width}px`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    check(`mobile chart leaves room beside frozen labels at ${width}px`, await liveTimeline.locator('.timeline-scroll').evaluate(scroll => scroll.clientWidth - scroll.querySelector('.timeline-action-label').offsetWidth >= 80));
    if (width === 390) {
      await liveTimeline.locator('summary').click();
      await liveTimeline.locator('.timeline-scroll').evaluate(scroll => { scroll.scrollTop = 0; scroll.scrollLeft = 0; });
      await liveTimeline.screenshot({ path: 'output/playwright/gantt-preview-mobile.png' });
    }
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
  const batchRecipe = counts => ({ id: 'oversized-batches', title: 'Oversized batches', servings: 1, ingredients: [],
    steps: counts.map((yieldCount, index) => ({ action: 'Stir sauce.', scaling: { mode: 'batch', group: `pan-${index}`, yield: yieldCount, capacity: 1, secondsPerBatch: 1 } })) });
  const beforeImport = await page.evaluate(() => JSON.stringify(localStorage));
  for (const counts of [[2001], [1001, 1001]]) {
    await page.locator('#recipe-import-file').setInputFiles({ name: 'batch-limit.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ recipes: [batchRecipe(counts)] })) });
    await page.waitForFunction(() => document.getElementById('recipe-import-file').value === '');
    check('oversized import leaves storage untouched', beforeImport === await page.evaluate(() => JSON.stringify(localStorage)));
    check('oversized import explains the 2000-action budget', dialogs.at(-1).includes('2,000 cooking actions'));
  }
  // Simulate data saved by an older release: preserve it for export without
  // letting one unsupported recipe break unrelated views or navigation.
  await page.evaluate(async raw => {
    const { STATE } = await import('/modules/state.js');
    STATE.customRecipes.push((await import('/modules/recipe-domain.js')).normalizeRecipeForStorage(raw));
    STATE.pantry = [{ id: 'rice', name: 'Rice', quantity: 1, unit: 'g' }];
    STATE.scheduledMeals = { 'Monday-Dinner': { recipeId: raw.id, portions: 1 } };
    (await import('/modules/storage.js')).saveStateToStorage({ sync: false });
    (await import('/modules/recipe-views.js')).renderDashboard();
    (await import('/modules/recipe-views.js')).renderExploreRecipes();
  }, batchRecipe([2001]));
  check('saved oversized recipes keep Explore usable', (await page.locator('#explore-recipes-grid').innerText()).includes('Timing unavailable'));
  await page.evaluate(async () => {
    const recipe = (await import('/modules/recipe-domain.js')).getRecipeById('oversized-batches');
    (await import('/modules/recipe-detail.js')).showRecipeDetailsModal(recipe);
    (await import('/modules/recipe-transfer.js')).openRecipeExportModal();
  });
  check('saved oversized recipe remains exportable', await page.locator('.recipe-export-check[value="oversized-batches"]').count() === 1);
  await page.evaluate(async () => {
    (await import('/modules/recipe-transfer.js')).closeRecipeExportModal();
    (await import('/modules/navigation.js')).switchView('planner');
  });
  check('planner explains unsupported saved meals', (await page.locator('#planner-shopping-list').innerText()).includes('Shopping list unavailable'));
  await page.evaluate(async () => (await import('/modules/navigation.js')).switchView('play'));
  await page.locator('#play-recipe-select').selectOption('oversized-batches', { force: true });
  check('unsupported saved recipe cannot start playback', await page.locator('#play-recipe-start-btn').isDisabled() && (await page.locator('#play-portion-note').innerText()).includes('2,000 cooking actions'));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.reload();
  await page.locator('[data-view="pantry"]').click();
  check('reload with an oversized saved recipe preserves navigation', await page.locator('#view-pantry').isVisible());
  check('no uncaught browser errors', errors.length === 0);
  console.log(`${passed} recipe dependency browser checks passed.`);
} finally { await browser?.close(); server.kill(); }
