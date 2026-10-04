import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, relative, extname } from 'node:path';
import { clientFiles } from './client-files.mjs';

const root = resolve(process.env.SERVE_DIST === '1' ? 'dist' : '.');
const port = Number(process.env.PORT || 5175);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.LICENSE': 'text/plain' };
const allowed = new Set(await clientFiles());
allowed.add('asset-manifest.json');
const securityHeaders = {};
if (process.env.SERVE_DIST === '1') {
  const lines = (await readFile(resolve(root, '_headers'), 'utf8')).split(/\r?\n/);
  for (const line of lines.slice(1)) {
    if (!line.startsWith('  ')) break;
    const separator = line.indexOf(':');
    securityHeaders[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
}
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = pathname === '/' ? 'index.html' : pathname.slice(1);
    const target = resolve(root, file);
    if (relative(root, target).startsWith('..') || !allowed.has(file)) { response.writeHead(404).end(); return; }
    const data = file === 'asset-manifest.json' && process.env.SERVE_DIST !== '1'
      ? JSON.stringify({ version: 'development-ai-providers-1', assets: [...allowed].filter(file => !['sw.js', 'asset-manifest.json'].includes(file)).map(file => `/${file}`) })
      : await readFile(target);
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', ...securityHeaders });
    response.end(data);
  } catch { response.writeHead(404).end(); }
});
server.listen(port, '127.0.0.1', () => console.log(`Cooking Companion: http://localhost:${server.address().port}/`));
