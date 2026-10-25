import { escapeHtml } from './utils.js';

export const ACTION_GROUPS = [
  ['Preparation and Cutting', ['Peel', 'Slice', 'Chop', 'Dice', 'Mince', 'Grate']],
  ['Mixing and Combining', ['Mix / Blend', 'Stir', 'Whisk / Beat', 'Knead', 'Season']],
  ['Cooking Methods and Heat Application', ['Boil', 'Simmer', 'Steam', 'Fry', 'Sauté', 'Bake / Roast', 'Grill']],
  ['Finishing and Serving', ['Mash', 'Drain', 'Garnish', 'Serve']]
];
export const ACTION_TYPES = ACTION_GROUPS.flatMap(([, actions]) => actions);
export function normalizeActionType(value) {
  return ACTION_TYPES.includes(value) ? value : 'Other';
}
export function inferActionType(text = '') {
  const aliases = { 'Mix / Blend': 'mix|blend', 'Whisk / Beat': 'whisk|beat', 'Bake / Roast': 'bake|roast', 'Sauté': 'sauté|saute' };
  return ACTION_TYPES.find(type => new RegExp(`\\b(?:${aliases[type] || type.toLowerCase()})\\b`, 'i').test(text)) || 'Other';
}
export function actionVideoSource(type) {
  return ACTION_TYPES.includes(type) ? `assets/actions/${type.toLowerCase().replace('é', 'e').replaceAll(' / ', '-').replaceAll(' ', '-')}.webm` : '';
}
export function actionTypeOptions(selected = 'Other') {
  return `<option value="Other" ${selected === 'Other' ? 'selected' : ''}>Other (no video)</option>` + ACTION_GROUPS.map(([group, actions]) => `<optgroup label="${group}">${actions.map(type => `<option value="${type}" ${selected === type ? 'selected' : ''}>${type}</option>`).join('')}</optgroup>`).join('');
}
export function actionVideoHtml(type) {
  const src = actionVideoSource(type);
  return src ? `<figure class="action-video-preview"><video src="${src}" autoplay loop muted playsinline controls preload="metadata" aria-label="${escapeHtml(type)} illustrated demonstration"></video><figcaption>${escapeHtml(type)} · Illustrated demonstration</figcaption></figure>` : '';
}
