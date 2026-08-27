// LinkVault - Firebase Configuration & Cloud Sync Module
import { initializeApp } from " https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js\;
import {
 getAuth,
 GoogleAuthProvider,
 signInWithPopup,
 signInWithRedirect,
 getRedirectResult,
 signOut,
 onAuthStateChanged
} from \https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js\;
import {
 getFirestore,
 doc,
 getDoc,
 setDoc,
 onSnapshot,
 enableIndexedDbPersistence
} from \https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js\;

// 1. You can paste your Firebase configuration below, OR paste it in the App UI under Account Settings.
// Get yours free at https://console.firebase.google.com
export const DEFAULT_FIREBASE_CONFIG = {
 apiKey: \YOUR_API_KEY\,
 authDomain: \YOUR_PROJECT_ID.firebaseapp.com\,
 projectId: \YOUR_PROJECT_ID\,
 storageBucket: \YOUR_PROJECT_ID.appspot.com\,
 messagingSenderId: \YOUR_MESSAGING_SENDER_ID\,
 appId: \YOUR_APP_ID\
};

const STORAGE_CONFIG_KEY = \linkvault.firebase.config.v1\;

export function getActiveFirebaseConfig() {
 try {
 const saved = localStorage.getItem(STORAGE_CONFIG_KEY);
 if (saved) {
 const parsed = JSON.parse(saved);
 if (parsed.apiKey && parsed.apiKey !== \YOUR_API_KEY\) return parsed;
 }
 } catch (e) {}

 if (DEFAULT_FIREBASE_CONFIG.apiKey && DEFAULT_FIREBASE_CONFIG.apiKey !== \YOUR_API_KEY\) {
 return DEFAULT_FIREBASE_CONFIG;
 }
 return null;
}

export function saveFirebaseConfig(cfg) {
 localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(cfg));
}

export function clearFirebaseConfig() {
 localStorage.removeItem(STORAGE_CONFIG_KEY);
}

let app = null;
let auth = null;
let db = null;
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export function initFirebase() {
 const config = getActiveFirebaseConfig();
 if (!config) return { initialized: false };

 try {
 if (!app) {
 app = initializeApp(config);
 auth = getAuth(app);
 db = getFirestore(app);

 // Attempt offline persistence for Firestore
 try {
 enableIndexedDbPersistence(db).catch(() => {
 // Multiple tabs open or not supported, ignore
 });
 } catch (e) {}
 }
 return { initialized: true, app, auth, db };
 } catch (err) {
 console.error(\Firebase initialization error:\, err);
 return { initialized: false, error: err };
 }
}

export async function loginWithGoogle() {
 const { initialized } = initFirebase();
 if (!initialized || !auth) {
 throw new Error(\Firebase is not configured yet. Please configure your Firebase project first.\);
 }
 try {
 return await signInWithPopup(auth, googleProvider);
 } catch (err) {
 // If popup is blocked on mobile, fallback to redirect
 if (err.code === \auth/popup-blocked\ || err.code === \auth/popup-closed-by-user\) {
 throw err;
 }
 return await signInWithRedirect(auth, googleProvider);
 }
}

export async function logoutUser() {
 if (auth) {
 await signOut(auth);
 }
}

export function listenToAuth(callback) {
 const { initialized } = initFirebase();
 if (!initialized || !auth) {
 callback(null, false);
 return () => {};
 }
 return onAuthStateChanged(auth, (user) => {
 callback(user, true);
 });
}

// Subscribe to real-time cloud data for user
export function subscribeToUserCloudData(uid, onData, onError) {
 if (!db) return () => {};
 const docRef = doc(db, \users\, uid);
 return onSnapshot(
 docRef,
 (docSnap) => {
 if (docSnap.exists()) {
 onData(docSnap.data());
 } else {
 onData({ files: [] });
 }
 },
 (err) => {
 console.error(\Firestore snapshot error:\, err);
 if (onError) onError(err);
 }
 );
}

// Save user data to cloud
export async function saveUserCloudData(uid, data) {
 if (!db) return;
 const docRef = doc(db, \users\, uid);
 await setDoc(docRef, { ...data, lastSyncedAt: Date.now() }, { merge: true });
}
