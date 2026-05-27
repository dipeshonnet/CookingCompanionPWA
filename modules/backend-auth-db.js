window.BackendAuthDB = (function () {
  let ready = false;
  let auth = null;
  let db = null;

  function hasConfig() {
    const cfg = window.FIREBASE_CONFIG || {};
    return Boolean(cfg.apiKey && cfg.authDomain && cfg.projectId && cfg.appId);
  }

  function init() {
    if (!window.firebase || !hasConfig()) return false;
    if (!firebase.apps.length) {
      firebase.initializeApp(window.FIREBASE_CONFIG);
    }
    auth = firebase.auth();
    db = firebase.firestore();
    try {
      db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
    } catch (_) {}
    ready = true;
    return true;
  }

  function isReady() {
    return ready;
  }

  function onAuthStateChanged(handler) {
    if (!ready || !auth) return () => {};
    return auth.onAuthStateChanged(handler);
  }

  async function signInGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    const result = await auth.signInWithPopup(provider);
    return result.user;
  }

  async function signInEmail(email, password) {
    const result = await auth.signInWithEmailAndPassword(email, password);
    return result.user;
  }

  async function signUpEmail(email, password) {
    const result = await auth.createUserWithEmailAndPassword(email, password);
    return result.user;
  }

  async function signOut() {
    await auth.signOut();
  }

  async function loadUserState(uid) {
    if (!ready) return null;
    const snap = await db.collection("users").doc(uid).collection("app").doc("state").get();
    return snap.exists ? snap.data() : null;
  }

  async function saveUserState(uid, payload) {
    if (!ready) return;
    await db.collection("users").doc(uid).collection("app").doc("state").set(payload, { merge: true });
  }

  return {
    init,
    isReady,
    onAuthStateChanged,
    signInGoogle,
    signInEmail,
    signUpEmail,
    signOut,
    loadUserState,
    saveUserState
  };
})();
