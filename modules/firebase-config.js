// Public web config only. Production builds can supply FIREBASE_WEB_CONFIG.
// Firebase rules protect data; this config is not an admin credential.
export const FIREBASE_CONFIG = globalThis.FIREBASE_CONFIG || {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};
