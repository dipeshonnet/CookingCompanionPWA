import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { clientFiles } from './client-files.mjs';

const output = resolve('dist');
const files = await clientFiles();
const hash = createHash('sha256');
for (const file of files) {
  let data = await readFile(file);
  if (file === 'modules/firebase-config.js' && process.env.FIREBASE_WEB_CONFIG) {
    const config = JSON.parse(process.env.FIREBASE_WEB_CONFIG);
    for (const field of ['apiKey', 'authDomain', 'projectId', 'appId']) if (!config[field]) throw new Error(`Firebase public config is missing ${field}`);
    if (config.private_key || config.client_email) throw new Error('Use Firebase web config, never service-account credentials');
    data = Buffer.from(`export const FIREBASE_CONFIG = ${JSON.stringify(config, null, 2)};\n`);
  }
  hash.update(file).update(data);
  await mkdir(dirname(resolve(output, file)), { recursive: true });
  await writeFile(resolve(output, file), data);
}
const version = hash.digest('hex').slice(0, 16);
const worker = await readFile(resolve(output, 'sw.js'), 'utf8');
await writeFile(resolve(output, 'sw.js'), worker.replace('development-ai-providers-1', version));
await writeFile(resolve(output, 'asset-manifest.json'), JSON.stringify({ version, assets: files.filter(file => file !== 'sw.js').map(file => `/${file}`) }));
await copyFile('_headers', resolve(output, '_headers'));
console.log(`Built ${files.length} static files in dist; offline version ${version}.`);
