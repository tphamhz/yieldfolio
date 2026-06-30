import { initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import {
  doc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = Object.values(firebaseConfig).every(Boolean);

const app = firebaseConfigured ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export function observeAuth(onUser, onError) {
  if (!auth) {
    onUser(null);
    return () => {};
  }
  return onAuthStateChanged(auth, onUser, onError);
}

export async function signInWithGoogle() {
  if (!auth) throw new Error("Google sign-in has not been configured yet.");
  await setPersistence(auth, browserLocalPersistence);
  return signInWithPopup(auth, googleProvider);
}

export async function signOutUser() {
  if (auth) await signOut(auth);
}

export function subscribeToPortfolio(userId, onData, onError) {
  if (!db) return () => {};
  return onSnapshot(doc(db, "portfolios", userId), onData, onError);
}

export function savePortfolio(userId, data) {
  if (!db) return Promise.resolve();
  return setDoc(doc(db, "portfolios", userId), {
    ...data,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}
