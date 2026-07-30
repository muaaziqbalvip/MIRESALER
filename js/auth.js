/* ============================================================
   MI RESELLER PROGRAM — Real Firebase Authentication
   Google Sign-In + Email/Password + Forgot Password + session
   persistence via onAuthStateChanged (not just localStorage).
   ============================================================ */
import { initializeApp, getApp } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged,
  signOut, setPersistence, browserLocalPersistence, updatePassword
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import { getDatabase, ref, get } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-database.js';
import { FB, ADMIN_EMAIL } from './config.js';

let app; try { app = getApp(); } catch (e) { app = initializeApp(FB); }
export const auth = getAuth(app);
export const db = getDatabase(app);

// Keep the user signed in across tabs/reloads (real persistence, not a manual flag)
setPersistence(auth, browserLocalPersistence).catch(() => {});

/** Google popup sign-in. Returns the Firebase user. */
export async function googleLogin() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

/** Email/password sign-in for resellers who set up an email-based account. */
export async function emailLogin(email, password) {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

/** Create a Firebase Auth account (used when linking a reseller's email to real auth). */
export async function emailRegister(email, password) {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  return result.user;
}

/** Sends a real password-reset email via Firebase. User clicks link, sets new password on Firebase's hosted page. */
export async function forgotPassword(email) {
  await sendPasswordResetEmail(auth, email, {
    url: location.origin + location.pathname.replace(/[^/]*$/, '') + 'index.html'
  });
}

export async function logout() {
  try { await signOut(auth); } catch (e) {}
  localStorage.removeItem('mi_s');
  sessionStorage.removeItem('ms');
}

/**
 * Resolve the app-level reseller/admin session for a given Firebase Auth user.
 * Looks up 'resellers' by matching email, or grants admin if email===ADMIN_EMAIL.
 */
export async function resolveSession(fbUser) {
  if (!fbUser?.email) return null;
  if (fbUser.email === ADMIN_EMAIL) {
    return { id: 'ADMIN', name: 'Muaaz Iqbal', role: 'admin', email: fbUser.email, photo: fbUser.photoURL, uid: fbUser.uid };
  }
  const snap = await get(ref(db, 'resellers'));
  if (snap.exists()) {
    let found = null;
    snap.forEach(child => {
      const d = child.val();
      if (d.email === fbUser.email && d.active !== false) found = { ...d, id: child.key, role: 'reseller', uid: fbUser.uid };
    });
    if (found) return found;
  }
  return null;
}

/**
 * Wires up real session persistence for a page. Calls onReady(session) once
 * Firebase has resolved auth state AND the app-level session is known — this
 * runs on every reload/tab, not just at initial login, so tokens actually expire
 * and get refreshed the proper way instead of a stale localStorage flag.
 * @param {(session:object|null, fbUser:object|null)=>void} onReady
 */
export function watchAuthState(onReady) {
  onAuthStateChanged(auth, async (fbUser) => {
    if (!fbUser) {
      // No Firebase Auth session. Fall back to legacy phone/password session
      // (for resellers who registered before Google/email auth existed).
      const legacy = sessionStorage.getItem('ms') || localStorage.getItem('mi_s');
      if (legacy) { try { onReady(JSON.parse(legacy), null); return; } catch (e) {} }
      onReady(null, null);
      return;
    }
    const session = await resolveSession(fbUser);
    if (session) {
      localStorage.setItem('mi_s', JSON.stringify(session));
      sessionStorage.setItem('ms', JSON.stringify(session));
    }
    onReady(session, fbUser);
  });
}
