import { toCloudRecords, diffCloudRecords } from './cloud-records.js';
import { FIREBASE_CONFIG } from './firebase-config.js';

export function createBackend(config, sdk = () => globalThis.firebase) {
  let auth;
  let db;
  const baselines = new Map();
  const ready = () => Boolean(auth && db);

  async function init() {
    if (!config.apiKey || !config.authDomain || !config.projectId || !config.appId) return false;
    if (!sdk()) {
      for (const component of ['app', 'auth', 'firestore']) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = `https://www.gstatic.com/firebasejs/10.14.1/firebase-${component}-compat.js`;
          const timeout = setTimeout(() => reject(new Error('Authentication SDK timed out')), 15000);
          script.onload = () => { clearTimeout(timeout); resolve(); };
          script.onerror = () => { clearTimeout(timeout); reject(new Error('Authentication SDK unavailable')); };
          document.head.appendChild(script);
        });
      }
    }
    const firebase = sdk();
    if (!firebase.apps.length) firebase.initializeApp(config);
    auth = firebase.auth();
    db = firebase.firestore();
    if ('caches' in globalThis) {
      const urls = ['app', 'auth', 'firestore'].map(name => `https://www.gstatic.com/firebasejs/10.14.1/firebase-${name}-compat.js`);
      caches.open('cooking-companion-vendor-10.14.1').then(cache => cache.addAll(urls)).catch(() => {});
    }
    return true;
  }

  async function loadUserState(uid) {
    if (!ready()) throw new Error('Database not initialized');
    const root = db.collection('users').doc(uid);
    const profile = await root.collection('app').doc('profile').get();
    if (profile.exists && profile.data().schemaVersion === 2) {
      const [pantry, recipes, meals] = await Promise.all(['pantry', 'recipes', 'meals'].map(name => root.collection(name).get()));
      const payload = {
        user: profile.data().user || {}, pantry: pantry.docs.map(doc => doc.data()),
        customRecipes: recipes.docs.map(doc => doc.data()),
        scheduledMeals: Object.fromEntries(meals.docs.map(doc => [decodeURIComponent(doc.id), doc.data().recipeId]))
      };
      baselines.set(uid, toCloudRecords(payload));
      return payload;
    }
    const app = root.collection('app');
    const [pantry, schedule, recipes, legacy] = await Promise.all(['pantry', 'schedule', 'recipes', 'state'].map(name => app.doc(name).get()));
    const payload = profile.exists || pantry.exists || schedule.exists || recipes.exists ? {
      user: profile.exists ? profile.data().user : {}, pantry: pantry.data()?.items || [],
      customRecipes: recipes.data()?.items || [], scheduledMeals: schedule.data()?.items || {}
    } : legacy.exists ? legacy.data() : null;
    baselines.set(uid, new Map());
    return payload;
  }

  async function saveUserState(uid, payload) {
    if (!ready() || auth.currentUser?.uid !== uid) throw new Error('Not authenticated for this account');
    const next = toCloudRecords(payload);
    const changes = diffCloudRecords(baselines.get(uid) || new Map(), next).sort((a, b) => Number(a.path === 'app/profile') - Number(b.path === 'app/profile'));
    for (const change of changes) {
      if (new TextEncoder().encode(JSON.stringify(change.value || {})).length > 800_000) throw new Error('Record exceeds the safe document size');
    }
    for (let offset = 0; offset < changes.length; offset += 450) {
      const batch = db.batch();
      for (const change of changes.slice(offset, offset + 450)) {
        const reference = db.doc(`users/${uid}/${change.path}`);
        if (change.remove) batch.delete(reference);
        else batch.set(reference, change.value);
      }
      await batch.commit();
    }
    baselines.set(uid, next);
  }

  return {
    init, isReady: ready, loadUserState, saveUserState,
    currentUser: () => auth?.currentUser || null,
    needsMigration: uid => baselines.has(uid) && baselines.get(uid).size === 0,
    onAuthStateChanged: handler => auth.onAuthStateChanged(handler),
    signInGoogle: () => auth.signInWithPopup(new (sdk().auth.GoogleAuthProvider)()),
    signInEmail: (email, password) => auth.signInWithEmailAndPassword(email, password),
    signUpEmail: (email, password) => auth.createUserWithEmailAndPassword(email, password),
    signOut: async () => { await auth.signOut(); baselines.clear(); }
  };
}

export const BackendAuthDB = createBackend(FIREBASE_CONFIG);
