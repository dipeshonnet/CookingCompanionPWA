import { normalizeMealSelection } from './recipe-portions.js';

export function toCloudRecords(payload) {
  const records = new Map([['app/profile', { schemaVersion: 2, user: payload.user || {} }]]);
  if (payload.cooking?.activeTimers?.length || payload.cooking?.playSession) records.set('app/cooking', payload.cooking);
  for (const item of payload.pantry || []) records.set(`pantry/${encodeURIComponent(item.id)}`, item);
  for (const recipe of payload.customRecipes || []) records.set(`recipes/${encodeURIComponent(recipe.id)}`, recipe);
  for (const [slot, value] of Object.entries(payload.scheduledMeals || {})) {
    const selection = normalizeMealSelection(value);
    if (selection) records.set(`meals/${encodeURIComponent(slot)}`, selection);
  }
  return records;
}

export function diffCloudRecords(previous, next) {
  const changes = [];
  for (const [path, value] of next) {
    if (JSON.stringify(previous.get(path)) !== JSON.stringify(value)) changes.push({ path, value });
  }
  for (const path of previous.keys()) if (!next.has(path)) changes.push({ path, remove: true });
  return changes;
}

export function mergePendingState(remote, base, local) {
  const merged = toCloudRecords(remote);
  for (const change of diffCloudRecords(toCloudRecords(base), toCloudRecords(local))) {
    if (change.remove) merged.delete(change.path); else merged.set(change.path, change.value);
  }
  const payload = { user: merged.get('app/profile')?.user || {}, pantry: [], customRecipes: [], scheduledMeals: {} };
  if (merged.has('app/cooking')) payload.cooking = merged.get('app/cooking');
  for (const [path, value] of merged) {
    if (path.startsWith('pantry/')) payload.pantry.push(value);
    if (path.startsWith('recipes/')) payload.customRecipes.push(value);
    if (path.startsWith('meals/')) payload.scheduledMeals[decodeURIComponent(path.slice(6))] = normalizeMealSelection(value);
  }
  return payload;
}
