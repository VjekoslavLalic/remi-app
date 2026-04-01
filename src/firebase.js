import { initializeApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, onAuthStateChanged, setPersistence, signInAnonymously } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId,
);

let app = null;
let db = null;
let auth = null;
let authInitError = null;

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
}

export async function ensureAnonymousAuth() {
  if (!auth) {
    return null;
  }

  if (auth.currentUser) {
    return auth.currentUser;
  }

  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (error) {
    console.warn('Failed to set auth persistence', error);
  }

  try {
    const credential = await signInAnonymously(auth);
    authInitError = null;
    return credential.user;
  } catch (error) {
    authInitError = error;
    throw error;
  }
}

export function onRemiAuthStateChange(callback) {
  if (!auth) {
    callback(null);
    return () => {};
  }

  return onAuthStateChanged(auth, callback);
}

export function getCurrentUserUid() {
  return auth?.currentUser?.uid || null;
}

export function getFirebaseAuthErrorMessage(error) {
  if (!error) return '';
  return error.code ? `${error.code}: ${error.message}` : error.message || 'Unknown Firebase Auth error';
}

export { app, auth, db, authInitError };
