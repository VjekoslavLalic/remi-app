import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  linkWithPopup,
  linkWithRedirect,
  onAuthStateChanged,
  setPersistence,
  signInAnonymously,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';
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
let persistencePromise = null;
let redirectResultPromise = Promise.resolve(null);

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);

  redirectResultPromise = (async () => {
    try {
      await ensurePersistence();
      const result = await getRedirectResult(auth);
      authInitError = null;
      return result;
    } catch (error) {
      authInitError = error;
      console.error('Firebase redirect auth failed', error);
      return null;
    }
  })();
}

function ensurePersistence() {
  if (!auth) {
    return Promise.resolve();
  }

  if (!persistencePromise) {
    persistencePromise = setPersistence(auth, browserLocalPersistence).catch((error) => {
      console.warn('Failed to set auth persistence', error);
    });
  }

  return persistencePromise;
}

function createGoogleProvider() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

export async function waitForAuthInit() {
  return redirectResultPromise;
}

export async function signInAsGuest() {
  if (!auth) {
    return null;
  }

  await waitForAuthInit();
  await ensurePersistence();

  if (auth.currentUser) {
    return auth.currentUser;
  }

  const credential = await signInAnonymously(auth);
  authInitError = null;
  return credential.user;
}

export async function signInWithGoogle() {
  if (!auth) {
    return null;
  }

  await waitForAuthInit();
  await ensurePersistence();

  const provider = createGoogleProvider();
  const currentUser = auth.currentUser;

  try {
    if (currentUser?.isAnonymous) {
      const credential = await linkWithPopup(currentUser, provider);
      authInitError = null;
      return credential.user;
    }

    const credential = await signInWithPopup(auth, provider);
    authInitError = null;
    return credential.user;
  } catch (error) {
    const canFallbackToRedirect = [
      'auth/popup-blocked',
      'auth/popup-closed-by-user',
      'auth/cancelled-popup-request',
      'auth/operation-not-supported-in-this-environment',
    ].includes(error?.code);

    if (!canFallbackToRedirect) {
      authInitError = error;
      throw error;
    }

    if (currentUser?.isAnonymous) {
      await linkWithRedirect(currentUser, provider);
      return null;
    }

    await signInWithRedirect(auth, provider);
    return null;
  }
}

export async function signOutFromRemi() {
  if (!auth) {
    return;
  }

  await signOut(auth);
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
