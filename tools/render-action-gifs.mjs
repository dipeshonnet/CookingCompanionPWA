// node tools/render-action-gifs.mjs; requires Playwright, a browser, Python + Pillow.
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { ACTION_TYPES, actionVideoSource } from '../modules/action-types.js';
import { drawCookingAction } from './action-illustrations.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const browser = await chromium.launch({ headless:true, channel:process.env.PLAYWRIGHT_CHANNEL || 'msedge' });
let total = 0;
try {
  const page = await browser.newPage();
  for (const type of ACTION_TYPES) {
    const frames=[];
    for(let i=0;i<16;i++) frames.push(await page.evaluate(drawCookingAction, { type, time:i/16 }));
    const result=spawnSync(process.env.PYTHON_EXECUTABLE || 'python', ['tools/encode-action-gifs.py'], {input:JSON.stringify({frames,output:actionVideoSource(type)}),encoding:'utf8',windowsHide:true,maxBuffer:1024*1024});
    if(result.status!==0) throw new Error(result.stderr || result.error?.message || 'GIF encoding failed');
    const bytes=Number(result.stdout.trim());total+=bytes;console.log(`${type}: ${bytes} bytes`);
  }
  console.log(`Total: ${total} bytes`);
  if(total>498246)throw new Error('GIF set exceeds the original video size budget');
}finally{await browser.close();}
