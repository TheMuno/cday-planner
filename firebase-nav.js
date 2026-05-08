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

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ── CONFIG ───────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyBQPqbtlfHPLpB-JYbyxDZiugu4NqwpSeM",
  authDomain:        "askkhonsu-map.firebaseapp.com",
  projectId:         "askkhonsu-map",
  storageBucket:     "askkhonsu-map.appspot.com",
  messagingSenderId: "266031876218",
  appId:             "1:266031876218:web:ec93411f1c13d9731e93c3",
  measurementId:     "G-Z7F4NJ4PHW",
};

// Safe init — won't conflict if firebase-auth.js also loads on the login page
const app  = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

// ── ELEMENT REFS ─────────────────────────────────────────────
const $navLoginBtn = document.querySelector('[data-ak="login"]');
const $userAvatar  = document.querySelector('[data-ak="user-avatar"]');

const USER_STORAGE_KEY = 'ak-user';
const PROVIDER_LABELS  = {
  'google.com':   'Google',
  'facebook.com': 'Facebook',
  'password':     'Email & Password',
};

let currentUser = null;
const LOGIN_PAGE_URL = '/log-in';

// ── FAST-PATH: render from cache before Firebase resolves ────
// Avoids a flash of logged-out nav on page load
const cached = localStorage.getItem(USER_STORAGE_KEY);
if (cached) {
  try {
    const u = JSON.parse(cached);
    if ($navLoginBtn) $navLoginBtn.classList.add('visibility-hidden');
    renderAvatar(u.photoURL, u.displayName || u.email);
  } catch (_) {
    localStorage.removeItem(USER_STORAGE_KEY);
  }
}

// ── AUTH STATE ───────────────────────────────────────────────
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify({
      uid:        user.uid,
      email:      user.email,
      displayName: user.displayName,
      photoURL:   user.photoURL,
      providerId: user.providerData[0]?.providerId || 'password',
    }));
    if ($navLoginBtn) $navLoginBtn.classList.add('visibility-hidden');
    renderAvatar(user.photoURL, user.displayName || user.email);
  } else {
    currentUser = null;
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
  if (!currentUser) return;
  const user      = currentUser;
  const provider  = PROVIDER_LABELS[user.providerData[0]?.providerId] || 'Email & Password';
  const avatarSrc = user.photoURL
    || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email || 'U')}&background=ff7f34&color=fff`;

  Swal.fire({
    html: `
      <div style="font-family:'Neuemontreal',sans-serif;display:flex;flex-direction:column;align-items:center;gap:12px;padding:8px 0;">
        <img src="${avatarSrc}" alt="avatar" style="width:72px;height:72px;border-radius:50%;object-fit:cover;" />
        ${user.displayName ? `<div style="font-size:1.1rem;font-weight:600;">${user.displayName}</div>` : ''}
        ${user.email ? `<div style="font-size:0.9rem;color:#666;">${user.email}</div>` : ''}
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
