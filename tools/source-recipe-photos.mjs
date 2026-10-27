// Fetch freely reusable Commons photographs and retain their attribution metadata.
// Run from the project root. Review output/recipe-photos/candidates.json before selecting.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { APP_RECIPES } from '../recipes.js';

const directory = 'output/recipe-photos';
await mkdir(directory, { recursive: true });
const aliases = {
  'Vegetable Uttapam': 'Uttapam', 'Besan Chilla': 'Besan cheela',
  'Moong Dal Chilla': 'Moong dal cheela', 'Khaman Dhokla': 'Khaman',
  'Methi Thepla': 'Thepla', 'Rajma Masala': 'Rajma', 'Tomato Rasam': 'Tomato rasam',
  'Mor Kuzhambu': 'Mor kuzhambu', 'Spinach Kootu': 'Keerai kootu',
  'Bhindi Masala': 'Bhindi masala', 'Beans Poriyal': 'Beans poriyal',
  'Vegetable Hakka Noodles': 'Vegetable noodles', 'Vegetable Samosa': 'Samosa',
  'Banana Cinnamon Oatmeal': 'Banana oatmeal', 'Yogurt Fruit Granola Bowl': 'Yogurt fruit granola',
  'Egg-Free Banana Pancakes': 'Banana pancakes', 'Turmeric Tofu Scramble': 'Tofu scramble',
  'Falafel Wraps': 'Falafel wrap', 'Hummus Vegetable Wraps': 'Hummus wrap',
  'Vegetable Quesadillas': 'Vegetarian quesadilla', 'Spinach Ricotta Lasagne': 'Spinach lasagna',
  'Vegetable Pad Thai': 'Vegetarian pad thai', 'Thai Green Vegetable Curry': 'Green curry vegetables',
  'Black Bean Tacos': 'Black bean tacos', 'Vegetable Sushi Rolls': 'Vegetarian sushi',
};
const clean = value => String(value || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&#039;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
async function search(title, retries = 0) {
  const params = new URLSearchParams({ action: 'query', generator: 'search', gsrsearch: `"${aliases[title] || title}" filetype:bitmap`, gsrnamespace: '6', gsrlimit: '6', prop: 'imageinfo', iiprop: 'url|extmetadata|size', iiurlwidth: '800', format: 'json' });
  const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, { headers: { 'User-Agent': 'CookingCompanionPhotoImporter/1.0 (free recipe photo collection)' }, signal: AbortSignal.timeout(40000) });
  if (response.status === 429) {
    if (retries >= 3) throw new Error('Commons rate limit persisted; retry later.');
    await new Promise(resolve => setTimeout(resolve, (Number(response.headers.get('retry-after')) || 60) * 1000 + 1000));
    return search(title, retries + 1);
  }
  if (!response.ok) throw new Error(`Commons ${response.status}`);
  const data = await response.json();
  return Object.values(data.query?.pages || {}).sort((a, b) => a.index - b.index).flatMap(page => {
    const info = page.imageinfo?.[0];
    const meta = info?.extmetadata || {};
    const license = clean(meta.LicenseShortName?.value);
    if (!info || !clean(meta.Artist?.value) || !/^(CC BY(?:-SA)? [\d.]+|CC0(?: 1.0)?|Public domain)$/i.test(license) || Math.min(info.width, info.height) < 300) return [];
    return [{ file: page.title, source: info.descriptionurl, url: info.thumburl || info.url,
      author: clean(meta.Artist?.value), license, licenseUrl: meta.LicenseUrl?.value || 'https://commons.wikimedia.org/wiki/Commons:Public_domain',
      description: clean(meta.ImageDescription?.value), width: info.width, height: info.height }];
  });
}
let results = {};
try { results = JSON.parse(await readFile(`${directory}/candidates.json`, 'utf8')); } catch {}
const refresh = process.argv.find(argument => argument.startsWith('--refresh='))?.slice(10).split(',') || [];
const missing = APP_RECIPES.filter(recipe => recipe.image === 'assets/logo.png' || refresh.includes(recipe.id));
for (const recipe of missing) {
    if (results[recipe.id]?.candidates?.length && !refresh.includes(recipe.id)) continue;
    try {
      const candidates = await search(recipe.title);
      results[recipe.id] = { title: recipe.title, candidates };
      console.log(`${recipe.title}: ${candidates.length}`);
    } catch (error) { console.error(`${recipe.title}: ${error.message}`); }
  await writeFile(`${directory}/candidates.json`, JSON.stringify(results, null, 2) + '\n');
  await new Promise(resolve => setTimeout(resolve, 6500));
}
