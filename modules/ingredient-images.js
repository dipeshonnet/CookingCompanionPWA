import { COMMON_INGREDIENTS } from './ingredient-catalogue.js';
import { escapeHtml } from './utils.js';

const normalize = value => String(value || '').toLowerCase().trim().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const catalogue = new Map();
for (const name of Object.values(COMMON_INGREDIENTS).flat()) {
  const key = normalize(name);
  catalogue.set(key, name);
  catalogue.set(`${key}s`, name);
  catalogue.set(`${key}es`, name);
}
const aliases = {
  aubergine: 'Brinjal', eggplant: 'Brinjal', eggplants: 'Brinjal', bhindi: 'Okra', ladyfinger: 'Okra',
  'ladies finger': 'Okra', 'green pepper': 'Green bell pepper', capsicum: 'Green bell pepper',
  peas: 'Green peas', 'cauliflower florets': 'Cauliflower', cilantro: 'Fresh coriander', coriander: 'Fresh coriander',
  'coriander leaves': 'Fresh coriander', 'curry leaf': 'Curry leaves', 'green chili': 'Green chilli',
  'red chili powder': 'Red chilli powder', 'turmeric powder': 'Turmeric', haldi: 'Turmeric',
  jeera: 'Cumin seeds', 'ground cumin': 'Cumin powder', 'ground coriander': 'Coriander powder',
  hing: 'Asafoetida', amchoor: 'Amchur', 'dried mango powder': 'Amchur', 'dried fenugreek leaves': 'Kasuri methi',
  'split mung beans': 'Moong dal', 'mung dal': 'Moong dal', 'red lentils': 'Masoor dal',
  'split chickpeas': 'Chana dal', 'black gram': 'Urad dal', 'white chickpeas': 'Kabuli chana',
  'black chickpeas': 'Kala chana', 'kidney beans': 'Rajma', 'mung beans': 'Green gram',
  yoghurt: 'Yogurt', dahi: 'Curd', 'cottage cheese': 'Paneer', mawa: 'Khoya',
  atta: 'Whole wheat flour', 'all purpose flour': 'Maida', 'plain flour': 'Maida',
  semolina: 'Semolina (rava)', rava: 'Semolina (rava)', sooji: 'Semolina (rava)',
  'flattened rice': 'Poha', 'rice flakes': 'Poha', 'finger millet': 'Ragi', 'pearl millet': 'Bajra',
  sorghum: 'Jowar', 'gram flour': 'Besan', 'chickpea flour': 'Besan', 'bread rolls': 'Pav bread rolls',
  prawns: 'Prawns', 'chicken thighs': 'Chicken thigh', 'white fish': 'Fish', 'cooking oil': 'Oil',
  'vegetable oil': 'Oil', 'bicarbonate of soda': 'Baking soda', 'bicarbonate soda': 'Baking soda'
};
for (const [alias, name] of Object.entries(aliases)) catalogue.set(alias, name);

export function ingredientImageSource(name) {
  const key = normalize(name);
  let canonical = catalogue.get(key);
  // Handle familiar preparation suffixes without treating arbitrary dishes as ingredients.
  if (!canonical) canonical = catalogue.get(key.replace(/ (?:chopped|diced|sliced|grated|minced|florets)$/, ''));
  if (!canonical) return '';
  const slug = canonical.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `/assets/ingredients/${slug}.webp`;
}

export function ingredientThumbnail(name) {
  const source = ingredientImageSource(name);
  return source
    ? `<img class="ingredient-thumbnail" src="${source}" alt="" aria-hidden="true" width="32" height="32" loading="lazy" decoding="async">`
    : `<span class="ingredient-thumbnail ingredient-thumbnail-placeholder" aria-hidden="true">${escapeHtml(String(name || '').trim().slice(0, 1).toUpperCase() || '·')}</span>`;
}

export function ingredientLabel(name) {
  return `<span class="ingredient-name-with-photo">${ingredientThumbnail(name)}<span>${escapeHtml(name)}</span></span>`;
}
