import { BackendAuthDB } from './backend-auth-db.js';
import { mergePendingState } from './cloud-records.js';
import { renderApp } from './navigation.js';
import { STATE, RUNTIME } from './state.js';
import { scopedStorageKey, readStored, loadStateFromStorage, hydrateStateFromPayload, getPersistentState, saveStateToStorage, hasPendingCloudChanges, syncStateToCloud, resetSignedOutRuntimeState } from './storage.js';

function clearAuthPassword() {
  const input = document.getElementById('auth-password-input');
  if (input) input.value = '';
}

export async function applyAuthUser(user) {
  clearAuthPassword();
  const generation = ++RUNTIME.authGeneration;
  RUNTIME.suppressCloudSave = true;
  resetSignedOutRuntimeState();
  RUNTIME.currentAuthUid = '';
  loadStateFromStorage(user ? user.uid : 'guest');
  if (!user) { RUNTIME.suppressCloudSave = false; renderApp(); return; }
  STATE.user.loggedIn = false;
  renderApp();
  let loaded = false;
  let cloud;
  try { cloud = await BackendAuthDB.loadUserState(user.uid); loaded = true; }
  catch (error) { console.warn('Using this account\'s device cache until cloud access returns:', error); }
  if (generation !== RUNTIME.authGeneration) return;
  if (cloud) {
    const pending = hasPendingCloudChanges();
    const base = readStored('sync-base', { user: {}, pantry: [], customRecipes: [], scheduledMeals: {} });
    hydrateStateFromPayload(pending ? mergePendingState(cloud, base, getPersistentState()) : cloud);
    if (!pending) localStorage.setItem(scopedStorageKey('sync-base'), JSON.stringify(getPersistentState()));
  }
  STATE.user.email = user.email || '';
  if (!cloud && user.displayName && STATE.user.name === 'Chef Guest') STATE.user.name = user.displayName;
  STATE.user.loggedIn = true;
  RUNTIME.currentAuthUid = user.uid;
  RUNTIME.localMode = false;
  RUNTIME.suppressCloudSave = false;
  saveStateToStorage({ sync: false });
  if (loaded && (!cloud || hasPendingCloudChanges() || BackendAuthDB.needsMigration(user.uid))) await syncStateToCloud();
  renderApp();
}

export async function initAuthenticationLayer() {
  let ready = false;
  try { ready = await BackendAuthDB.init(); } catch (error) { console.warn('Authentication unavailable:', error); }
  for (const id of ['btn-login-google', 'btn-login-email', 'btn-auth-email-signin', 'btn-auth-email-signup']) {
    const button = document.getElementById(id);
    if (button) { button.disabled = !ready; button.title = ready ? '' : 'Cloud sign-in is not configured or is offline'; }
  }
  const status = document.getElementById('auth-status');
  if (status) status.textContent = ready ? '' : 'Cloud sign-in unavailable. Device-only recipes are still available.';
  if (ready) RUNTIME.authUnsubscribe = BackendAuthDB.onAuthStateChanged(applyAuthUser);
  window.addEventListener('online', () => {
    if (RUNTIME.currentAuthUid && hasPendingCloudChanges()) syncStateToCloud();
  });
  window.addEventListener('pagehide', () => saveStateToStorage({ sync: false }));
}

async function authenticate(action) {
  clearAuthPassword();
  if (!BackendAuthDB.isReady()) return;
  try { await action(); } catch (error) {
    console.warn('Sign-in failed:', error.code);
    alert('Sign-in failed. Check your credentials, connection, and authorized domain.');
  }
}

export function handleGoogleSignIn() { return authenticate(() => BackendAuthDB.signInGoogle()); }

export function getAuthCredentialsFromInputs() {
  const email = document.getElementById('auth-email-input')?.value.trim();
  const password = document.getElementById('auth-password-input')?.value || '';
  if (!email || !password) { alert('Enter email and password.'); return null; }
  clearAuthPassword();
  return { email, password };
}

export async function signInLocalOnly() {
  clearAuthPassword();
  if (RUNTIME.currentAuthUid) await handleLogout();
  else if (BackendAuthDB.currentUser()) await BackendAuthDB.signOut();
  ++RUNTIME.authGeneration;
  loadStateFromStorage('guest');
  RUNTIME.localMode = true;
  STATE.user.loggedIn = true;
  STATE.user.email = '';
  localStorage.setItem(scopedStorageKey('local-mode'), 'true');
  renderApp();
}

export function handleEmailSignIn() {
  const credentials = getAuthCredentialsFromInputs();
  if (credentials) return authenticate(() => BackendAuthDB.signInEmail(credentials.email, credentials.password));
}

export function handleEmailSignUp() {
  const credentials = getAuthCredentialsFromInputs();
  if (credentials) return authenticate(() => BackendAuthDB.signUpEmail(credentials.email, credentials.password));
}

export async function handleLogout() {
  clearAuthPassword();
  saveStateToStorage({ sync: false });
  if (RUNTIME.currentAuthUid) {
    if (hasPendingCloudChanges()) await syncStateToCloud();
    try { await BackendAuthDB.signOut(); } catch { alert('Sign-out failed. Please try again.'); }
  } else {
    localStorage.removeItem(scopedStorageKey('local-mode', 'guest'));
    RUNTIME.localMode = false;
    await applyAuthUser(null);
  }
}
