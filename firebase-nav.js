// ============================================================
// FIREBASE NAV — firebase-nav.js
// Load this SITEWIDE via Webflow Site Settings → Custom Code
// → Before </body> tag:
//
//   <script type="module" src="YOUR_HOSTED_URL/firebase-nav.js"></script>
//
// Requires SweetAlert2 loaded before this script.
//
// Webflow elements needed (sitewide, in your navbar):
//   data-ak="login"       → login button/link (hidden when logged in)
//   data-ak="user-avatar" → div that receives the avatar img
// ============================================================

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";

// ── CONFIG ───────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyBQPqbtlfHPLpB-JYbyxDZiugu4NqwpSeM",
  authDomain:        "auth.askkhonsu.com",
  projectId:         "askkhonsu-map",
  storageBucket:     "askkhonsu-map.appspot.com",
  messagingSenderId: "266031876218",
  appId:             "1:266031876218:web:ec93411f1c13d9731e93c3",
  measurementId:     "G-Z7F4NJ4PHW",
};

// Safe init — won't conflict if firebase-auth.js also loads on the login page
const app  = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

// firebase-firestore.js is only actually needed by findUserDocByUid below, which itself only
// runs for the rare case of a signed-in user with no email on their auth object. As a static
// import it used to be fetched — and block evaluation of this entire module, including the
// onAuthStateChanged registration below — before any code here could run at all. This script
// loads sitewide via Site Settings on every single page, ahead of each page's own embeds, so
// that blocking delayed every page-specific sign-in-state reveal behind it (e.g.
// build-itinerary.js's sign-in-to-save button). Loading it lazily removes that entirely.
let dbPromise = null;
function getDb() {
  if (!dbPromise) {
    dbPromise = import("https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js").then(mod => {
      let db;
      try {
        db = mod.initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
      } catch (e) {
        db = mod.getFirestore(app); // Firestore already initialized for this app elsewhere on the page
      }
      return { ...mod, db };
    });
  }
  return dbPromise;
}

// ── ELEMENT REFS ─────────────────────────────────────────────
const $navLoginBtn = document.querySelector('[data-ak="login"]');
const $userAvatar  = document.querySelector('[data-ak="user-avatar"]');

const USER_STORAGE_KEY = 'ak-user';
const PROVIDER_LABELS  = {
  'google.com':   'Google',
  'facebook.com': 'Facebook',
  'password':     'Email & Password',
};

let currentUser      = null;
let currentUserEmail = null;
// Fast-path cached user (below) can render the avatar before onAuthStateChanged
// resolves — on a slow mobile connection that gap is wide enough for a tap to
// land while currentUser is still null. Keep the cached data so the modal has
// something to show instead of silently no-oping until Firebase catches up.
let cachedUser        = null;
const LOGIN_PAGE_URL  = '/log-in';

// Firestore doc IDs are "user-<email>" (see firebase-auth.js), not the Auth
// UID, so a user with no email on their auth object (e.g. Facebook without
// the email scope) can't be looked up by doc ID directly — fall back to a
// query on the stored uid field instead.
async function findUserDocByUid(uid) {
  const { collection, query, where, getDocs, db } = await getDb();
  const snap = await getDocs(query(collection(db, "users"), where("uid", "==", uid)));
  return snap.empty ? null : snap.docs[0];
}

// ── FAST-PATH: render from cache before Firebase resolves ────
// Avoids a flash of logged-out nav on page load
const cached = localStorage.getItem(USER_STORAGE_KEY);
if (cached) {
  try {
    const u = JSON.parse(cached);
    cachedUser = u;
    if ($navLoginBtn) $navLoginBtn.classList.add('visibility-hidden');
    renderAvatar(u.photoURL, u.displayName || u.email);
  } catch (_) {
    localStorage.removeItem(USER_STORAGE_KEY);
  }
}

// ── AUTH STATE ───────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;

    let email = user.email;
    if (!email) {
      try {
        const snap = await findUserDocByUid(user.uid);
        if (snap) email = snap.data().email || null;
      } catch (_) {}
    }
    currentUserEmail = email;
    if (email) localStorage.setItem("ak-userMail", email);

    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify({
      uid:         user.uid,
      email:       email,
      displayName: user.displayName,
      photoURL:    user.photoURL,
      providerId:  user.providerData[0]?.providerId || 'password',
    }));
    cachedUser = null;
    if ($navLoginBtn) $navLoginBtn.classList.add('visibility-hidden');
    renderAvatar(user.photoURL, user.displayName || email);
  } else {
    currentUser      = null;
    currentUserEmail = null;
    cachedUser       = null;
    localStorage.removeItem(USER_STORAGE_KEY);
    if ($navLoginBtn) $navLoginBtn.classList.remove('visibility-hidden');
    if ($userAvatar) $userAvatar.innerHTML = '';
  }
});

// ── AVATAR ───────────────────────────────────────────────────
function renderAvatar(photoURL, nameOrEmail) {
  if (!$userAvatar) return;
  const src = photoURL
    || `https://ui-avatars.com/api/?name=${encodeURIComponent(nameOrEmail || 'U')}&background=ff7f34&color=fff`;

  let img = $userAvatar.querySelector('img');
  if (!img) {
    img = document.createElement('img');
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;cursor:pointer;';
    $userAvatar.style.cursor = 'pointer';
    $userAvatar.appendChild(img);
    $userAvatar.addEventListener('click', () => showUserModal());
  }
  img.src = src;
  img.alt = nameOrEmail || 'User avatar';
}

// ── USER MODAL ───────────────────────────────────────────────
function showUserModal() {
  // currentUser lags behind the avatar render on a slow connection (it's only
  // set once onAuthStateChanged resolves), so fall back to the cached data the
  // avatar was actually rendered from rather than silently doing nothing.
  if (!currentUser && !cachedUser) return;

  const displayName = currentUser ? currentUser.displayName : cachedUser.displayName;
  const email       = currentUser ? currentUserEmail : cachedUser.email;
  const providerId  = currentUser ? currentUser.providerData[0]?.providerId : cachedUser.providerId;
  const photoURL    = currentUser ? currentUser.photoURL : cachedUser.photoURL;
  const provider    = PROVIDER_LABELS[providerId] || 'Email & Password';
  const avatarSrc = photoURL
    || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName || email || 'U')}&background=ff7f34&color=fff`;

  Swal.fire({
    html: `
      <div style="font-family:'Neuemontreal',sans-serif;display:flex;flex-direction:column;align-items:center;gap:12px;padding:8px 0;">
        <img src="${avatarSrc}" alt="avatar" style="width:72px;height:72px;border-radius:50%;object-fit:cover;" />
        ${displayName ? `<div style="font-size:1.1rem;font-weight:600;">${displayName}</div>` : ''}
        ${email ? `<div style="font-size:0.9rem;color:#666;">${email}</div>` : ''}
        <div style="font-size:0.8rem;background:#f3f3f3;padding:4px 12px;border-radius:999px;">${provider}</div>
        <button id="swal-logout-btn" style="margin-top:8px;padding:8px 24px;border:none;border-radius:999px;background:#ff7f34;color:#fff;font-family:'Neuemontreal',sans-serif;font-size:0.9rem;cursor:pointer;">Log out</button>
      </div>
    `,
    showConfirmButton: false,
    showCloseButton: true,
    background: '#fff',
    width: 320,
    didOpen: () => {
      document.getElementById('swal-logout-btn').addEventListener('click', async () => {
        Swal.close();
        showLoader();
        await signOut(auth);
        window.location.href = LOGIN_PAGE_URL;
      });
    },
  });
}

// ── LOADER ───────────────────────────────────────────────────
function showLoader() {
  if (document.getElementById("nav-loader-overlay")) return;
  if (!document.getElementById("nav-spinner-style")) {
    const style = document.createElement("style");
    style.id = "nav-spinner-style";
    style.textContent = "@keyframes nav-spin { to { transform: rotate(360deg); } }";
    document.head.appendChild(style);
  }
  const overlay = document.createElement("div");
  overlay.id = "nav-loader-overlay";
  Object.assign(overlay.style, {
    position: "fixed", inset: "0",
    background: "rgba(255,255,255,0.5)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: "9999",
  });
  const spinner = document.createElement("div");
  Object.assign(spinner.style, {
    width: "40px", height: "40px",
    border: "4px solid #e5e7eb", borderTopColor: "#111",
    borderRadius: "50%", animation: "nav-spin 0.7s linear infinite",
  });
  overlay.appendChild(spinner);
  document.body.appendChild(overlay);
}

// ── TOAST ────────────────────────────────────────────────────
function showToast(message, icon = 'info') {
  Swal.fire({
    toast: true,
    position: 'bottom-end',
    icon,
    title: message,
    showConfirmButton: false,
    timer: 3000,
    background: '#ff7f34',
    color: '#fff',
    didOpen: (toast) => { toast.style.fontFamily = 'Neuemontreal, sans-serif'; },
  });
}
