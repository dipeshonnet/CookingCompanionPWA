import { readdir } from 'node:fs/promises';

export async function clientFiles() {
  const files = ['index.html', 'styles.css', 'recipes.js', 'ai.js', 'app.js', 'manifest.json', 'favicon.ico', 'sw.js'];
  for (const folder of ['modules', 'assets', 'vendor']) {
    for (const name of (await readdir(folder, { recursive: true })).sort()) {
      if (/\.(js|png|webp|webm|ico|LICENSE)$/.test(name)) files.push(`${folder}/${name.replaceAll('\\', '/')}`);
    }
  }
  return files;
}
