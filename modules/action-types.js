import { escapeHtml } from './utils.js';

export const ACTION_GROUPS = [
  ['Preparation and Cutting', ['Rinse', 'Wash', 'Soak', 'Measure', 'Peel', 'Slice', 'Chop', 'Dice', 'Mince', 'Grate', 'Crush', 'Sift', 'Roll']],
  ['Mixing and Combining', ['Mix / Blend', 'Stir', 'Whisk / Beat', 'Knead', 'Fold', 'Toss', 'Marinate', 'Season']],
  ['Cooking Methods and Heat Application', ['Heat', 'Boil', 'Simmer', 'Steam', 'Fry', 'Sauté', 'Bake / Roast', 'Grill', 'Toast', 'Flip', 'Cover']],
  ['Finishing and Serving', ['Mash', 'Drain', 'Rest', 'Cool', 'Garnish', 'Serve']]
];
export const ACTION_TYPES = ACTION_GROUPS.flatMap(([, actions]) => actions);
export function normalizeActionType(value) {
  return ACTION_TYPES.includes(value) ? value : 'Other';
}
export function inferActionType(text = '') {
  const aliases = {
    'Mix / Blend': 'mix|blend', 'Whisk / Beat': 'whisk|beat', 'Bake / Roast': 'bake|roast', 'Sauté': 'saute',
    Rinse: 'rins(?:e|es|ed|ing)', Wash: 'wash(?:es|ed|ing)?', Soak: 'soak(?:s|ed|ing)?',
    Measure: 'measur(?:e|es|ed|ing)', Crush: 'crush(?:es|ed|ing)?', Sift: 'sift(?:s|ed|ing)?',
    Roll: 'roll(?:s|ed|ing)?', Fold: 'fold(?:s|ed|ing)?', Toss: 'toss(?:es|ed|ing)?',
    Marinate: 'marinat(?:e|es|ed|ing)', Heat: 'heat(?:s|ed|ing)?', Toast: 'toast(?:s|ed|ing)?',
    Flip: 'flip(?:s|ped|ping)?', Cover: 'cover(?:s|ed|ing)?', Rest: 'rest(?:s|ed|ing)?', Cool: 'cool(?:s|ed|ing)?'
  };
  const source = String(text ?? '').normalize('NFD').replace(/\p{M}/gu, '');
  let first = Infinity, result = 'Other';
  for (const type of ACTION_TYPES) {
    const match = new RegExp(`\\b(?:${aliases[type] || type.toLowerCase()})\\b`, 'i').exec(source);
    if (match && match.index < first) { first = match.index; result = type; }
  }
  return result;
}
export function actionVideoSource(type) {
  return ACTION_TYPES.includes(type) ? `assets/actions/${type.toLowerCase().replace('é', 'e').replaceAll(' / ', '-').replaceAll(' ', '-')}.gif` : '';
}
export function actionTypeOptions(selected = 'Other') {
  return `<option value="Other" ${selected === 'Other' ? 'selected' : ''}>Other (no animation)</option>` + ACTION_GROUPS.map(([group, actions]) => `<optgroup label="${group}">${actions.map(type => `<option value="${type}" ${selected === type ? 'selected' : ''}>${type}</option>`).join('')}</optgroup>`).join('');
}
export function actionVideoHtml(type) {
  const src = actionVideoSource(type);
  return src ? `<figure class="action-video-preview"><img src="${src}" width="320" height="200" loading="lazy" decoding="async" alt="${escapeHtml(type)} illustrated demonstration"><figcaption>${escapeHtml(type)} · Looping illustration</figcaption></figure>` : '';
}
