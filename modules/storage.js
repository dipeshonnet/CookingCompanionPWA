import { normalizeMealSelection } from './recipe-portions.js';
import { BackendAuthDB } from './backend-auth-db.js';
import { restorePlayBackgroundMusic, stopPlayBackgroundMusic } from './play-media.js';
import { normalizeRecipeForStorage } from './recipe-domain.js';
import { STATE, STORAGE_KEYS, RUNTIME, CLOUD_SYNC_DEBOUNCE_MS } from './state.js';
import { buildUserProfile } from './user-profile.js';
import { APP_CONFIG } from './app-config.js';
import { AI_PROVIDERS, getProviderConfig, updateAiSettingsFields } from './ai-providers.js';
import { serializeCookingState, restoreCookingState } from './cooking-state.js';

let saveChain = Promise.resolve();
let revision = 0;

export function scopedStorageKey(key, scope = RUNTIME.storageScope) {
  return `cook_comp_v2:${scope}:${key}`;
}

export function readStored(key, fallback, scope = RUNTIME.storageScope) {
  try {
    const value = localStorage.getItem(scopedStorageKey(key, scope));
    return value === null ? fallback : JSON.parse(value);
  } catch { return fallback; }
}

export function getAiProvider() {
  const provider = readStored(STORAGE_KEYS.AI_PROVIDER, APP_CONFIG.defaultAiProvider);
  return Object.hasOwn(AI_PROVIDERS, provider) ? provider : APP_CONFIG.defaultAiProvider;
}

export function setAiProvider(provider) {
  getProviderConfig(provider);
  localStorage.setItem(scopedStorageKey(STORAGE_KEYS.AI_PROVIDER), JSON.stringify(provider));
}

export function getApiKey(provider = getAiProvider()) {
  const value = readStored(getProviderConfig(provider).storageKey, '');
  return typeof value === 'string' ? value : '';
}

export function setApiKey(value, provider = getAiProvider()) {
  const storageKey = getProviderConfig(provider).storageKey;
  const key = String(value || '').trim();
  if (key) localStorage.setItem(scopedStorageKey(storageKey), JSON.stringify(key));
  else localStorage.removeItem(scopedStorageKey(storageKey));
  // The old unscoped Gemini entry belongs to the guest, never a signed-in account.
  if (RUNTIME.storageScope === 'guest' && provider === 'gemini') localStorage.removeItem(STORAGE_KEYS.GEMINI_KEY);
}

export function normalizePantry(items) {
  if (!Array.isArray(items)) return [];
  return items.filter(item => item && (typeof item === 'string' || typeof item === 'object')).map(item => {
    if (typeof item === 'string') item = { name: item, quantity: 1 };
    const quantity = Number(item.quantity ?? item.qty ?? 1);
    return {
      id: String(item.id || crypto.randomUUID()), name: String(item.name || item.ingredient || 'Item').trim(),
      quantity: Number.isFinite(quantity) ? quantity : 1,
      unit: String(item.unit || item.measure || 'pcs'), category: String(item.category || item.classifier || 'Other'),
      nutrition: item.nutrition && typeof item.nutrition === 'object' ? item.nutrition : null,
      nutritionQuantity: Number(item.nutritionQuantity || quantity) || 1
    };
  }).filter(item => item.quantity > 0);
}

function migrateLegacyGuest() {
  const marker = scopedStorageKey('legacy-migrated', 'guest');
  if (localStorage.getItem(marker)) return;
  // Preserve old keys as recovery copies; never transfer guest data to a login account.
  for (const key of [STORAGE_KEYS.USER, STORAGE_KEYS.PANTRY, STORAGE_KEYS.SCHEDULE, STORAGE_KEYS.CUSTOM_RECIPES]) {
    const old = localStorage.getItem(key);
    if (old && !localStorage.getItem(scopedStorageKey(key, 'guest'))) localStorage.setItem(scopedStorageKey(key, 'guest'), old);
  }
  localStorage.setItem(marker, 'true');
}

export function normalizeScheduledMeals(schedule) {
  if (!schedule || typeof schedule !== 'object' || Array.isArray(schedule)) return {};
  return Object.fromEntries(Object.entries(schedule).map(([slot, value]) => [slot, normalizeMealSelection(value)]).filter(([, value]) => value));
}

export function loadStateFromStorage(scope = 'guest') {
  RUNTIME.storageScope = scope;
  if (scope === 'guest') migrateLegacyGuest();
  // Move the legacy credential; do not retain a secret recovery copy after clearing it.
  if (scope === 'guest') {
    if (!localStorage.getItem(scopedStorageKey('legacy-ai-migrated'))) {
      const oldKey = localStorage.getItem(STORAGE_KEYS.GEMINI_KEY);
      if (oldKey && !localStorage.getItem(scopedStorageKey(STORAGE_KEYS.GEMINI_KEY))) setApiKey(oldKey, 'gemini');
      localStorage.setItem(scopedStorageKey('legacy-ai-migrated'), 'true');
    }
    // Also clean up browsers migrated by older releases, without restoring cleared keys.
    localStorage.removeItem(STORAGE_KEYS.GEMINI_KEY);
  }
  RUNTIME.localMode = scope === 'guest' && readStored('local-mode', false);
  STATE.user = buildUserProfile({ ...readStored(STORAGE_KEYS.USER, {}), loggedIn: RUNTIME.localMode });
  if (scope === 'guest') STATE.user.email = '';
  STATE.pantry = normalizePantry(readStored(STORAGE_KEYS.PANTRY, []));
  const schedule = readStored(STORAGE_KEYS.SCHEDULE, {});
  STATE.scheduledMeals = normalizeScheduledMeals(schedule);
  const recipes = readStored(STORAGE_KEYS.CUSTOM_RECIPES, []);
  STATE.customRecipes = Array.isArray(recipes) ? recipes.filter(r => r && typeof r === 'object' && r.title).map(normalizeRecipeForStorage) : [];
  const shared = readStored('shared-recipes', []);
  STATE.sharedRecipes = Array.isArray(shared) ? shared.filter(r => r && r.authorId && r.title).map(normalizeRecipeForStorage) : [];
  STATE.communityRatings = {};
  hydrateCookingState(readStored(STORAGE_KEYS.COOKING, {}));
  updateAiSettingsFields('ai', getAiProvider(), getApiKey());
  updateAiSettingsFields('profile-ai', getAiProvider(), getApiKey());
  restorePlayBackgroundMusic().catch(error => console.warn('Local music unavailable:', error));
}

export function hydrateStateFromPayload(payload = {}) {
  STATE.user = buildUserProfile({ ...STATE.user, ...payload.user, loggedIn: STATE.user.loggedIn });
  STATE.pantry = normalizePantry(payload.pantry);
  STATE.scheduledMeals = normalizeScheduledMeals(payload.scheduledMeals);
  STATE.customRecipes = Array.isArray(payload.customRecipes) ? payload.customRecipes.filter(r => r && r.title).map(normalizeRecipeForStorage) : [];
  hydrateCookingState(payload.cooking);
}

function hydrateCookingState(saved) {
  STATE.activeTimers.forEach(timer => clearInterval(timer.intervalId));
  clearInterval(RUNTIME.playSession.intervalId);
  const cooking = restoreCookingState(saved);
  STATE.activeTimers = cooking.activeTimers;
  RUNTIME.playSession = cooking.playSession;
}

export function getPersistentState() {
  const { loggedIn, email, ...user } = STATE.user;
  return JSON.parse(JSON.stringify({ user,
    pantry: STATE.pantry.map(({ nutritionLoading, nutritionRequestId, ...item }) => item),
    scheduledMeals: STATE.scheduledMeals, customRecipes: STATE.customRecipes,
    cooking: serializeCookingState(STATE.activeTimers, RUNTIME.playSession)
  }));
}

export function saveStateToStorage({ sync = true } = {}) {
  try {
    const data = getPersistentState();
    const records = [[STORAGE_KEYS.USER, data.user], [STORAGE_KEYS.PANTRY, data.pantry],
      [STORAGE_KEYS.SCHEDULE, data.scheduledMeals], [STORAGE_KEYS.CUSTOM_RECIPES, data.customRecipes],
      [STORAGE_KEYS.COOKING, data.cooking]];
    // Mark pending work before writing recipes: a full storage quota must not
    // persist a new recipe and then report its save as failed at the dirty flag.
    if (sync && RUNTIME.currentAuthUid) localStorage.setItem(scopedStorageKey('dirty'), 'true');
    for (const [key, value] of records) localStorage.setItem(scopedStorageKey(key), JSON.stringify(value));
    revision++;
    if (sync) scheduleStateSyncToCloud();
    return true;
  } catch (error) {
    console.error('Local save failed:', error);
    alert('Device storage is full or unavailable. Export your recipes before closing this page.');
    return false;
  }
}

export function hasPendingCloudChanges() { return readStored('dirty', false); }

export function scheduleStateSyncToCloud() {
  if (RUNTIME.suppressCloudSave || !RUNTIME.currentAuthUid || !BackendAuthDB.isReady()) return;
  clearTimeout(RUNTIME.cloudSaveTimer);
  RUNTIME.cloudSaveTimer = setTimeout(() => syncStateToCloud(), CLOUD_SYNC_DEBOUNCE_MS);
}

export async function syncStateToCloud() {
  if (RUNTIME.suppressCloudSave || !RUNTIME.currentAuthUid || !BackendAuthDB.isReady()) return false;
  clearTimeout(RUNTIME.cloudSaveTimer);
  const uid = RUNTIME.currentAuthUid;
  const scope = RUNTIME.storageScope;
  const savedRevision = revision;
  const payload = getPersistentState();
  const save = async () => {
    if (uid !== RUNTIME.currentAuthUid) return false;
    try {
      await BackendAuthDB.saveUserState(uid, payload);
      localStorage.setItem(scopedStorageKey('sync-base', scope), JSON.stringify(payload));
      if (scope === RUNTIME.storageScope && savedRevision === revision) localStorage.removeItem(scopedStorageKey('dirty', scope));
      return true;
    } catch (error) {
      console.warn('Cloud sync paused; changes remain on this device:', error);
      return false;
    }
  };
  saveChain = saveChain.then(save, save);
  return saveChain;
}

export function resetSignedOutRuntimeState() {
  RUNTIME.recipeEditContext = null;
  const builderTitle = document.getElementById('recipe-builder-title');
  if (builderTitle) builderTitle.textContent = 'Custom Recipe';
  const builderSave = document.getElementById('recipe-save-btn');
  if (builderSave) builderSave.textContent = 'Save Recipe';
  const builderCancel = document.getElementById('recipe-cancel-edit');
  if (builderCancel) builderCancel.hidden = true;
  const builderNote = document.getElementById('recipe-editor-note');
  if (builderNote) builderNote.textContent = '';
  clearTimeout(RUNTIME.cloudSaveTimer);
  if (RUNTIME.playSession.intervalId) clearInterval(RUNTIME.playSession.intervalId);
  STATE.activeTimers.forEach(timer => clearInterval(timer.intervalId));
  STATE.activeTimers = [];
  STATE.currentSelectedSlot = null;
  stopPlayBackgroundMusic();
  if (RUNTIME.playMusicTrack.url) URL.revokeObjectURL(RUNTIME.playMusicTrack.url);
  Object.values(RUNTIME.playVideoCache).forEach(url => URL.revokeObjectURL(url));
  RUNTIME.playMusicTrack = { name: '', url: '' };
  RUNTIME.playVideoCache = {};
  window.speechSynthesis?.cancel();
  RUNTIME.recipeSpeechRecognition?.stop();
  RUNTIME.recipeSpeechRecognition = null;
  RUNTIME.recipeSpeechIsListening = false;
  RUNTIME.playSession = { recipeId: '', availableCooks: 1, startedAt: null, upcoming: [], running: { 'Cook 1': null }, passiveRunning: [], completed: [], intervalId: null };
  RUNTIME.currentView = 'dashboard';
  RUNTIME.activeModalRecipe = null;
  RUNTIME.lastGeneratedRecipeObj = null;
  document.querySelectorAll('.modal-overlay').forEach(modal => { modal.style.display = 'none'; });
  document.getElementById('custom-recipe-form')?.reset();
  const notes = document.getElementById('recipe-talk-notes');
  if (notes) notes.value = '';
  const result = document.getElementById('ai-result-panel');
  if (result) result.style.display = 'none';
  for (const id of ['recipe-ingredients-list', 'recipe-steps-list']) {
    const element = document.getElementById(id);
    if (element) element.innerHTML = '';
  }
}
