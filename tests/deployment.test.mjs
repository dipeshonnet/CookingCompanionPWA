import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { clientFiles } from '../tools/client-files.mjs';
import { APP_CONFIG } from '../modules/app-config.js';

test('offline manifest covers every source module and no private/build artifacts', async () => {
  const files = await clientFiles();
  const manifest = JSON.parse(await readFile('asset-manifest.json', 'utf8'));
  assert.deepEqual([...manifest.assets].sort(), files.filter(file => file !== 'sw.js').map(file => '/' + file).sort());
  assert.equal(files.some(file => /^(tests|tools|output|docs|\.git)\//.test(file)), false);
});

test('hosting config uses the cooking subdomain and all AI providers', async () => {
  assert.equal(APP_CONFIG.productionOrigin, 'https://cooking.everydayai.work');
  assert.equal(APP_CONFIG.groqTextModel, 'openai/gpt-oss-20b');
  const files = await clientFiles();
  assert.ok(files.includes('ai.js'));
  assert.equal(files.includes('gemini.js'), false);
  const html = await readFile('index.html', 'utf8');
  assert.ok(html.includes('<script type="module" src="app.js">'));
  assert.equal(/\son\w+=/.test(html), false);
  assert.equal(html.includes('unpkg.com'), false);
  const manifest = JSON.parse(await readFile('manifest.json', 'utf8'));
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.start_url, '/');
});

test('public host headers do not permit inline script execution', async () => {
  const headers = await readFile('_headers', 'utf8');
  const scriptSources = headers.match(/script-src ([^;]+)/)[1];
  assert.equal(scriptSources.includes('unsafe-inline'), false);
  assert.ok(headers.includes("frame-ancestors 'none'"));
  for (const host of ['https://api.openai.com', 'https://api.groq.com', 'https://*.googleapis.com']) assert.ok(headers.match(/connect-src ([^;]+)/)[1].includes(host));
});
