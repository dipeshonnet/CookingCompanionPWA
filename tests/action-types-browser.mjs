import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { mkdir } from 'node:fs/promises';
const playwright = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const { chromium } = playwright.default || playwright;
const server = spawn(process.execPath, ['tools/dev-server.mjs'], { env: { ...process.env, PORT: '0' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let browser;
try {
  const url = await new Promise(resolve => server.stdout.on('data', data => { const match=String(data).match(/http:\/\/localhost:\d+\//);if(match)resolve(match[0]); }));
  browser = await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL || 'msedge'});
  const page = await browser.newPage({viewport:{width:390,height:844}});
  page.on('response', response => {if(response.url().endsWith('.gif') && response.status() !== 200)console.log('GIF response',response.status(),response.url());});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url);await page.locator('#btn-login-local').click();
  await page.evaluate(async()=>{const b=await import('/modules/recipe-builder.js');(await import('/modules/navigation.js')).switchView('ai-generator');b.ensureRecipeBuilderDefaults();});
  const row=page.locator('.recipe-step-row').first(), select=row.locator('.recipe-step-action-type');
  assert.equal(await select.locator('option').count(),39);
  assert.equal(await row.locator('.action-video-preview img').count(),0);
  const actions=await page.evaluate(async()=> (await import('/modules/action-types.js')).ACTION_TYPES);
  for(const type of actions){
    await select.selectOption(type);
    await row.locator('.action-video-preview img').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('.recipe-step-row .action-video-preview img')?.naturalWidth === 320);
    const media=await row.locator('.action-video-preview img').evaluate(img=>({width:img.naturalWidth,height:img.naturalHeight,source:img.currentSrc}));
    assert.ok(media.width===320 && media.height===200 && media.source.endsWith('.gif'));
  }
  await select.selectOption('Rinse');await row.scrollIntoViewIfNeeded();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await mkdir('output',{recursive:true});await page.screenshot({path:'output/action-gifs-mobile.png',fullPage:true});
  await select.selectOption('Other');assert.equal(await row.locator('.action-video-preview img').count(),0);
  await page.evaluate(async()=>{const b=await import('/modules/recipe-builder.js');b.populateRecipeFormFromDraft({steps:[{action:'Chop onion',actionType:'Other'},{action:'Rinse rice',actionType:'Rinse'}]});});
  assert.equal(await page.locator('.recipe-step-action-type').first().inputValue(),'Other');
  assert.equal(await page.locator('.recipe-step-row').first().locator('.action-video-preview img').count(),0);
  assert.equal(await page.locator('.recipe-step-action-type').nth(1).inputValue(),'Rinse');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  await page.context().setOffline(true);
  assert.ok(await page.evaluate(async () => {
    const { ACTION_TYPES, actionVideoSource } = await import('/modules/action-types.js');
    for (const type of ACTION_TYPES) {
      const response = await fetch(actionVideoSource(type), { cache: 'no-store' });
      if (!response.ok || response.headers.get('Content-Type') !== 'image/gif') return false;
      if (!(await response.text()).startsWith('GIF89a')) return false;
    }
    return true;
  }), 'all GIFs available offline');
  assert.deepEqual(errors,[]);
  console.log('PASS all 38 GIFs decode, dropdown previews update, Other clears, drafts retain selections, mobile fits, all GIFs work offline');
} finally {await browser?.close();server.kill();}
