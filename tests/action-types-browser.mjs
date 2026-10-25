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
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url);await page.locator('#btn-login-local').click();
  await page.evaluate(async()=>{const b=await import('/modules/recipe-builder.js');(await import('/modules/navigation.js')).switchView('ai-generator');b.ensureRecipeBuilderDefaults();});
  const row=page.locator('.recipe-step-row').first(), select=row.locator('.recipe-step-action-type');
  assert.equal(await select.locator('option').count(),23);
  assert.equal(await row.locator('video').count(),0);
  const actions=await page.evaluate(async()=> (await import('/modules/action-types.js')).ACTION_TYPES);
  for(const type of actions){
    await select.selectOption(type);
    await row.locator('video').evaluate(video => new Promise((resolve,reject)=>{if(video.readyState>=2)resolve();else{video.onloadeddata=resolve;video.onerror=()=>reject(new Error('Video failed'));setTimeout(()=>reject(new Error('Video timeout')),5000);}}));
    const media=await row.locator('video').evaluate(v=>({loop:v.loop,muted:v.muted,width:v.videoWidth,duration:v.duration}));
    assert.ok(media.loop && media.muted && media.width===400 && media.duration>1);
  }
  await select.selectOption('Dice');await row.scrollIntoViewIfNeeded();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await mkdir('output',{recursive:true});await page.screenshot({path:'output/action-types-mobile.png',fullPage:true});
  await select.selectOption('Other');assert.equal(await row.locator('video').count(),0);
  await page.evaluate(async()=>{const b=await import('/modules/recipe-builder.js');b.populateRecipeFormFromDraft({steps:[{action:'Chop onion',actionType:'Other'},{action:'Mix flour',actionType:'Mix / Blend'}]});});
  assert.equal(await page.locator('.recipe-step-action-type').first().inputValue(),'Other');
  assert.equal(await page.locator('.recipe-step-row').first().locator('video').count(),0);
  assert.equal(await page.locator('.recipe-step-action-type').nth(1).inputValue(),'Mix / Blend');
  assert.deepEqual(errors,[]);
  console.log('PASS all 22 videos decode, dropdown previews update, Other clears, drafts retain selections, mobile fits');
} finally {await browser?.close();server.kill();}
