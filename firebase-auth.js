// ============================================================
// FIREBASE AUTH FOR WEBFLOW
// Add element IDs in Webflow Designer > Element Settings panel:
//
//   google-btn       → Google button
//   facebook-btn     → Facebook button
//   login-email      → Email input
//   login-password   → Password input
//   login-submit     → Login / Sign Up submit button
//   signup-link      → "Not registered? Sign Up" link/text
//   auth-error       → A text element to show error messages
//   auth-mode-label  → (optional) element that shows "Login" or "Sign Up"
// ============================================================

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  linkWithCredential,
  fetchSignInMethodsForEmail,
  sendPasswordResetEmail,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";

// ── 1. YOUR FIREBASE CONFIG ─────────────────────────────────
// Replace these values with your project's config from:
// Firebase Console → Project Settings → Your Apps → SDK setup
const firebaseConfig = {
    apiKey: "AIzaSyBQPqbtlfHPLpB-JYbyxDZiugu4NqwpSeM",
    authDomain: "auth.askkhonsu.com",
    projectId: "askkhonsu-map",
    storageBucket: "askkhonsu-map.appspot.com",
    messagingSenderId: "266031876218",
    appId: "1:266031876218:web:ec93411f1c13d9731e93c3",
    measurementId: "G-Z7F4NJ4PHW"
};

// ── 2. WHERE TO SEND THE USER AFTER LOGIN ───────────────────
const REDIRECT_AFTER_LOGIN = localStorage.getItem('ak-login-redirect') || '/';

// ── 2b. MAKE.COM WEBHOOK (fires once per genuine sign-in) ────
const MAKE_WEBHOOK_URL = 'https://hook.us1.make.com/z0fx4wnlhhmdemvkvyic15xkleyd02um';

// ── 3. INIT ─────────────────────────────────────────────────
const app  = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ── 3b. DOC ID HELPERS ───────────────────────────────────────
// Firestore doc IDs are "user-<email>" (not the Firebase Auth UID), so an
// admin can find a user by scanning/searching the console. Email is
// normalized (trimmed + lowercased) so case differences don't create
// duplicate docs for the same person. The UID is still stored as a field
// (see saveUserProvider) so a doc can be located before its email is known —
// e.g. a returning Facebook user who denies the email scope again.
function userDocId(email) {
  return "user-" + email.trim().toLowerCase();
}

async function findUserDocByUid(uid) {
  const snap = await getDocs(query(collection(db, "users"), where("uid", "==", uid)));
  return snap.empty ? null : snap.docs[0];
}

// ── 4. ELEMENT REFS ─────────────────────────────────────────
const googleBtn            = document.getElementById("google-btn");
const facebookBtn          = document.getElementById("facebook-btn");
const emailInput           = document.getElementById("login-email");
const passwordInput        = document.getElementById("login-password");
const confirmPasswordInput = document.getElementById("confirm-password");
const confirmPasswordWrap  = document.getElementById("confirm-password-wrap");
const submitBtn            = document.getElementById("login-submit");
const signupLink           = document.getElementById("signup-link");
const errorEl              = document.getElementById("auth-error");
const modeLabel            = document.getElementById("auth-mode-label");
const forgotLink           = document.getElementById("forgot-password-link");
const forgotWrap           = document.getElementById("forgot-password-wrap");
const loginFormWrap        = document.getElementById("login-form-wrap");
const forgotEmailInput     = document.getElementById("forgot-email");
const forgotSubmitBtn      = document.getElementById("forgot-submit");
const forgotBackLink       = document.getElementById("forgot-back");
const successEl            = document.getElementById("auth-success");
const optInCheckbox        = document.querySelector('[data-ak="user-opt-in"]');

// Display-only formatting — the raw slug (e.g. "hotel_name") is what's stored
// in localStorage/Firestore and used for lookups; only the on-page text gets
// prettified (e.g. "Hotel Name"), so nothing else needs to change.
function formatHotelName(slug) {
  return slug
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Case 1's visibility rule is "there's a fresh referral in localStorage" —
// full stop, independent of login/signup mode. Social buttons are clickable
// in either mode, so gating this behind isSignUpMode meant anyone who signed
// up via Google/Facebook without ever touching the mode toggle never saw the
// checkbox at all. Run once at load; Case 2's email lookup is the only thing
// allowed to override it (show it) beyond this, and only while in login mode.
function syncOptInFromLocalStorage() {
  const hotelReferral = localStorage.getItem("ak-hotel-referral");
  if (optInCheckbox) optInCheckbox.toggleAttribute("data-ak-hidden", !hotelReferral);
  if (hotelReferral) {
    const hotelReferrerEl = document.querySelector('[data-ak-hotel-referrer]');
    if (hotelReferrerEl) hotelReferrerEl.textContent = formatHotelName(hotelReferral);
  }
}
syncOptInFromLocalStorage();

let isSignUpMode = false;
let pendingCredential = null;
let isSigningIn = false;
let redirectHandled = false; // prevents onAuthStateChanged and getRedirectResult racing

function isInAppBrowser() {
  const ua = navigator.userAgent || "";
  return /FBAN|FBAV|FB_IAB|Instagram|MicroMessenger/i.test(ua);
}

function isMobile() {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
}

function isFirefoxBrowser() {
  return /Firefox/i.test(navigator.userAgent || "");
}

// ── PENDING CREDENTIAL PERSISTENCE (sessionStorage) ──────────
const PENDING_CRED_KEY = "auth_pending_cred";

function savePendingCred(cred) {
  if (!cred) return;
  const data = { providerId: cred.providerId };
  if (cred.idToken)     data.idToken     = cred.idToken;
  if (cred.accessToken) data.accessToken = cred.accessToken;
  sessionStorage.setItem(PENDING_CRED_KEY, JSON.stringify(data));
}

function loadPendingCred() {
  try {
    const raw = sessionStorage.getItem(PENDING_CRED_KEY);
    if (!raw) return null;
    const { providerId, idToken, accessToken } = JSON.parse(raw);
    if (providerId === "google.com")   return GoogleAuthProvider.credential(idToken, accessToken);
    if (providerId === "facebook.com") return FacebookAuthProvider.credential(accessToken);
  } catch (_) {}
  return null;
}

function clearPendingCred() {
  sessionStorage.removeItem(PENDING_CRED_KEY);
}

pendingCredential = loadPendingCred();

// Capture the redirect destination once at load time so both getRedirectResult
// and onAuthStateChanged can reference it even after localStorage is cleared.
const storedRedirectDest = localStorage.getItem('ak-redirect-destination');

// ── Handle return from manual Facebook OAuth redirect (mobile) ──
const _fbHash  = new URLSearchParams(window.location.hash.slice(1));
const _fbQuery = new URLSearchParams(window.location.search);
const _fbToken = _fbHash.get('access_token');
const _fbIsFB  = _fbHash.get('state') === 'fb-mobile-auth' || _fbQuery.get('state') === 'fb-mobile-auth';

if (_fbIsFB) {
  history.replaceState(null, '', window.location.pathname);
  if (_fbToken) {
    redirectHandled = true;
    isSigningIn = true;
    showLoader();
    (async () => {
      try {
        const credential = FacebookAuthProvider.credential(_fbToken);
        const result = await signInWithCredential(auth, credential);
        await linkPendingCredential(result.user);
        let email = result.user.email;
        if (!email) {
          try {
            const snap = await findUserDocByUid(result.user.uid);
            if (snap) email = snap.data().email || null;
          } catch (_) {}
        }
        if (!email) {
          hideLoader();
          email = await collectMissingEmail();
          if (!email) {
            await signOut(auth);
            isSigningIn = false;
            showError("An email address is required to sign in with Facebook. Please try again.");
            return;
          }
          showLoader();
        }
        await saveUserProvider(result.user, email);
        localStorage.setItem('ak-userMail', email);
        try { await applySignupHotelReferral(email); } catch (_) {}
        isSigningIn = false;
        onUserLoginSuccess(result.user);
        window.location.replace(REDIRECT_AFTER_LOGIN);
      } catch (err) {
        isSigningIn = false;
        redirectHandled = false;
        hideLoader();
        handleAuthError(err);
      }
    })();
  } else {
    const fbErr = _fbQuery.get('error_description') || _fbQuery.get('error');
    if (fbErr) showError('Facebook sign-in failed: ' + fbErr);
  }
}

if (storedRedirectDest) {
  isSigningIn = true;
  showLoader();
}

// Handle result after OAuth redirect (desktop popup fallback)
getRedirectResult(auth).then(async (result) => {
  if (!result) {
    if (!redirectHandled) {
      isSigningIn = false;
      localStorage.removeItem('ak-redirect-destination');
      hideLoader();
      if (auth.currentUser && storedRedirectDest) {
        redirectHandled = true;
        window.location.replace(storedRedirectDest);
      }
    }
    return;
  }
  redirectHandled = true;
  try {
    await linkPendingCredential(result.user);
    let email = result.user.email;

    if (!email) {
      try {
        const snap = await findUserDocByUid(result.user.uid);
        if (snap) email = snap.data().email || null;
      } catch (_) {}
    }

    if (!email) {
      hideLoader();
      email = await collectMissingEmail();
      if (!email) {
        await signOut(auth);
        isSigningIn = false;
        localStorage.removeItem('ak-redirect-destination');
        showError("An email address is required to sign in with Facebook. Please try again.");
        return;
      }
      showLoader();
    }

    await saveUserProvider(result.user, email || undefined);
    if (email) localStorage.setItem("ak-userMail", email);
    localStorage.removeItem('ak-redirect-destination');
    try { await applySignupHotelReferral(email); } catch (_) {}
    onUserLoginSuccess(result.user);
    window.location.replace(storedRedirectDest || REDIRECT_AFTER_LOGIN);
  } catch (err) {
    isSigningIn = false;
    localStorage.removeItem('ak-redirect-destination');
    hideLoader();
    handleAuthError(err);
  }
}).catch((err) => {
  if (!redirectHandled) {
    isSigningIn = false;
    localStorage.removeItem('ak-redirect-destination');
    hideLoader();
  }
  if (err.message && err.message.includes('missing initial state')) {
    showError("Sign-in couldn't complete — your browser's storage was inaccessible.\nPlease open this page in Safari or Chrome and try again.");
    return;
  }
  handleAuthError(err);
});

// ── 5. HELPERS ───────────────────────────────────────────────
function showPopup(msg, duration, isError) {
  const popupId = isError ? "auth-error-popup" : "auth-success-popup";
  document.getElementById(popupId)?.remove();

  const backdrop = document.createElement("div");
  backdrop.id = popupId;
  Object.assign(backdrop.style, {
    position: "fixed", inset: "0",
    background: "rgba(0,0,0,0.5)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: "9998",
  });

  const card = document.createElement("div");
  Object.assign(card.style, {
    background: "#fff", borderRadius: "8px",
    padding: "24px 32px 24px 24px",
    maxWidth: "360px", width: "90%",
    position: "relative",
    boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
  });

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "×";
  Object.assign(closeBtn.style, {
    position: "absolute", top: "8px", right: "12px",
    background: "none", border: "none",
    fontSize: "20px", lineHeight: "1", cursor: "pointer", color: "#6b7280",
  });
  closeBtn.addEventListener("click", () => backdrop.remove());

  const text = document.createElement("p");
  text.innerHTML = msg.replace(/\n/g, "<br>");
  Object.assign(text.style, {
    margin: "0", fontSize: window.innerWidth > 768 ? "17px" : "14px",
    color: isError ? "#dc2626" : "#16a34a",
  });

  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });
  card.appendChild(closeBtn);
  card.appendChild(text);
  backdrop.appendChild(card);
  document.body.appendChild(backdrop);

  setTimeout(() => backdrop.remove(), duration);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showError(msg)  { showPopup(msg, 5000, true);  }
function clearError()    { document.getElementById("auth-error-popup")?.remove(); }
function showSuccess(msg){ showPopup(msg, 5000, false); }

function showLoader(message) {
  if (document.getElementById("auth-loader-overlay")) return;
  if (!document.getElementById("auth-spinner-style")) {
    const style = document.createElement("style");
    style.id = "auth-spinner-style";
    style.textContent = "@keyframes auth-spin { to { transform: rotate(360deg); } }";
    document.head.appendChild(style);
  }
  const overlay = document.createElement("div");
  overlay.id = "auth-loader-overlay";
  Object.assign(overlay.style, {
    position: "fixed", inset: "0",
    background: "#fff",
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    gap: "12px", zIndex: "9999",
  });
  if (message) {
    const label = document.createElement("p");
    label.textContent = message;
    Object.assign(label.style, { margin: "0", fontSize: "14px", color: "#111" });
    overlay.appendChild(label);
  }
  const spinner = document.createElement("div");
  Object.assign(spinner.style, {
    width: "40px", height: "40px",
    border: "4px solid #e5e7eb", borderTopColor: "#111",
    borderRadius: "50%", animation: "auth-spin 0.7s linear infinite",
  });
  overlay.appendChild(spinner);
  document.body.appendChild(overlay);
}

function hideLoader() {
  document.getElementById("auth-loader-overlay")?.remove();
}

// Returns a Promise that resolves with the entered email, or null if the user cancels.
function collectMissingEmail() {
  return new Promise((resolve) => {
    document.getElementById("auth-email-collect-popup")?.remove();

    const backdrop = document.createElement("div");
    backdrop.id = "auth-email-collect-popup";
    Object.assign(backdrop.style, {
      position: "fixed", inset: "0",
      background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: "9998",
    });

    const card = document.createElement("div");
    Object.assign(card.style, {
      background: "#fff", borderRadius: "8px",
      padding: "24px", maxWidth: "360px", width: "90%",
      boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
    });

    const msg = document.createElement("p");
    msg.textContent = "Facebook didn't share your email. Please enter it to continue.";
    Object.assign(msg.style, { margin: "0 0 14px", fontSize: "14px", color: "#111" });

    const input = document.createElement("input");
    input.type = "email";
    input.placeholder = "your@email.com";
    Object.assign(input.style, {
      width: "100%", padding: "8px 12px", boxSizing: "border-box",
      border: "1px solid #d1d5db", borderRadius: "6px",
      fontSize: "14px", marginBottom: "8px",
    });

    const errMsg = document.createElement("p");
    Object.assign(errMsg.style, { margin: "0 0 10px", fontSize: "12px", color: "#dc2626", display: "none" });

    const btn = document.createElement("button");
    btn.textContent = "Continue";
    Object.assign(btn.style, {
      width: "100%", padding: "10px", background: "#ff7f34", color: "#fff",
      border: "none", borderRadius: "6px", fontSize: "14px", cursor: "pointer",
      textAlign: "center",
    });

    const cancelLink = document.createElement("a");
    cancelLink.textContent = "Cancel";
    Object.assign(cancelLink.style, {
      display: "block", textAlign: "center", marginTop: "10px",
      fontSize: "13px", color: "#6b7280", cursor: "pointer",
    });

    btn.addEventListener("click", () => {
      const email = input.value.trim();
      if (!isValidEmail(email)) {
        errMsg.textContent = "Please enter a valid email address.";
        errMsg.style.display = "block";
        return;
      }
      backdrop.remove();
      resolve(email);
    });

    cancelLink.addEventListener("click", () => { backdrop.remove(); resolve(null); });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") btn.click(); });

    card.appendChild(msg);
    card.appendChild(input);
    card.appendChild(errMsg);
    card.appendChild(btn);
    card.appendChild(cancelLink);
    backdrop.appendChild(card);
    document.body.appendChild(backdrop);
    input.focus();
  });
}

async function saveHotelReferral(email, hotel, optedIn) {
  try {
    await setDoc(doc(db, "users", userDocId(email)), { hotelReferral: { hotel, optedIn } }, { merge: true });
  } catch (err) {
    console.error("saveHotelReferral write failed:", err.code || err.message, err);
    throw err;
  }
}

// Case 1 of the hotel-referral opt-in: applies no matter which sign-in method
// completes the flow, since the checkbox's visibility only ever depends on
// isSignUpMode + localStorage, not on email/password vs. Google vs. Facebook.
// Case 2 (returning-user DB lookup) stays email/password-only — social
// sign-in never has a pre-auth email typed to key that lookup off of.
async function applySignupHotelReferral(email) {
  const hotel = localStorage.getItem("ak-hotel-referral");
  console.log("applySignupHotelReferral:", { hotel, email });
  if (!hotel || !email) return;
  try {
    const snap = await getDoc(doc(db, "users", userDocId(email)));
    const existing = snap.exists() ? snap.data().hotelReferral : null;
    const alreadyConsented = existing && existing.hotel === hotel && existing.optedIn;
    const optedInNow = !!optInCheckbox?.checked;
    if (!alreadyConsented) {
      await saveHotelReferral(email, hotel, optedInNow);
    }
    // Only clear localStorage once consent is actually on record — either
    // just now, or from an earlier visit. Left unconsented, keep it: that's
    // what makes the checkbox keep resurfacing on this device on every future
    // visit/login, including via Google/Facebook, which has no other way to
    // know to show it.
    if (alreadyConsented || optedInNow) {
      localStorage.removeItem("ak-hotel-referral");
    }
  } catch (err) {
    console.error("applySignupHotelReferral failed:", err.code || err.message, err);
  }
}

function setMode(signUp) {
  isSignUpMode = signUp;
  if (submitBtn)           submitBtn.value              = signUp ? "Sign Up" : "Login";
  if (modeLabel)           modeLabel.textContent        = signUp ? "Sign Up" : "Login";
  if (signupLink)          signupLink.textContent       = signUp ? "Already registered? Login" : "Not registered? Sign Up";
  if (confirmPasswordWrap) confirmPasswordWrap.classList.toggle("hide", !signUp);
  if (confirmPasswordInput) confirmPasswordInput.value = "";
  if (forgotLink) forgotLink.classList.toggle("hide", signUp);
  clearError();
}

async function handleAuthError(err) {
  if (err.code === "auth/account-exists-with-different-credential") {
    // Save the credential the user just tried (e.g. Facebook)
    pendingCredential =
      FacebookAuthProvider.credentialFromError(err) ||
      GoogleAuthProvider.credentialFromError(err);
    savePendingCred(pendingCredential);

    const pendingName = pendingCredential?.providerId === "facebook.com" ? "Facebook" : "Google";

    let existingName = "another sign-in method";
    try {
      const email = err.customData?.email;
      if (email) {
        const methods = await fetchSignInMethodsForEmail(auth, email);
        const providerMap = { "google.com": "Google", "facebook.com": "Facebook", "password": "email and password" };
        existingName = providerMap[methods[0]] || existingName;
      }
    } catch (_) {}

    const instruction = existingName === "email and password"
      ? "enter your email and password below"
      : `click the ${existingName} button`;

    showError(
      `This email is already registered with ${existingName}. ` +
      `Please ${instruction} to sign in and automatically connect your ${pendingName} account.`
    );
    return;
  }

  if (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request") {
    return;
  }

  if (err.code === "auth/user-not-found") {
    setMode(true);
    showError("No account found with that email\nPlease Sign Up");
    return;
  }

  const messages = {
    "auth/wrong-password":       "Incorrect password.",
    "auth/invalid-credential":   "Incorrect email or password.",
    "auth/invalid-email":        "Please enter a valid email address.",
    "auth/email-already-in-use": "An account with this email already exists.",
    "auth/weak-password":        "Password must be at least 6 characters.",
  };
  showError(messages[err.code] || "Something went wrong. Please try again.");
}

async function saveUserProvider(user, emailOverride) {
  const email = emailOverride || user.email;
  if (!email) return; // no email yet — can't derive a doc ID (see findUserDocByUid callers)
  const normalizedEmail = email.trim().toLowerCase();
  const provider = user.providerData[0]?.providerId || "password";
  try {
    await setDoc(doc(db, "users", userDocId(normalizedEmail)), {
      uid:      user.uid,
      email:    normalizedEmail,
      provider,
      displayName: user.displayName || null,
    }, { merge: true });
  } catch (err) {
    console.error("saveUserProvider write failed:", err.code || err.message, err);
    throw err;
  }
}

// After a successful sign-in, link the pending credential if one was saved.
// Returns the linked provider name (e.g. "Google") if linking succeeded, otherwise null.
async function linkPendingCredential(user) {
  if (!pendingCredential) return null;
  const providerNames = { "google.com": "Google", "facebook.com": "Facebook" };
  const linkedName = providerNames[pendingCredential.providerId] || null;
  try {
    await linkWithCredential(user, pendingCredential);
    return linkedName;
  } catch (_) {
    // Already linked or incompatible — safe to ignore
  } finally {
    pendingCredential = null;
    clearPendingCred();
  }
  return null;
}

// Called once per genuine sign-in (Google/Facebook popup, Facebook mobile
// redirect, getRedirectResult, email/password) right before we navigate away
// from /log-in. Header avatar rendering happens separately, on the
// destination page, via firebase-nav.js's onAuthStateChanged listener.
function onUserLoginSuccess(user) {
  if (typeof gtag === 'function') {
    gtag('event', 'guest_auth_success', {
      'event_category': 'Funnel',
      'event_label': 'Successful Sign-In',
    });
  }
  sendToMake(user);
}

function sendToMake(user) {
  const ref = localStorage.getItem('ak-ref');
  const conf = localStorage.getItem('ak-conf');
  if (!ref || !conf) return;

  const adults = localStorage.getItem('ak-adult-num');
  const children = localStorage.getItem('ak-children-num');
  const email = user?.email || localStorage.getItem('ak-userMail') || '';

  let dateStr;
  try {
    dateStr = JSON.parse(localStorage.getItem('ak-travel-days'))?.dateStr;
  } catch (_) {}

  const payload = { ref, conf, email };
  if (adults) payload.adults = adults;
  if (children) payload.children = children;
  if (dateStr) payload.dateStr = dateStr;

  fetch(MAKE_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify(payload),
  }).catch(err => console.error('Failed to send data to Make.com:', err));
}

// ── 6. GOOGLE SIGN-IN ────────────────────────────────────────
if (googleBtn) {
  googleBtn.addEventListener("click", async () => {
    clearError();
    isSigningIn = true;
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      showLoader();
      await linkPendingCredential(result.user);
      await saveUserProvider(result.user);
      try { await applySignupHotelReferral(result.user.email); } catch (_) {}
      onUserLoginSuccess(result.user);
      window.location.replace(REDIRECT_AFTER_LOGIN);
    } catch (err) {
      isSigningIn = false;
      hideLoader();
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        // On mobile the popup opens as a new tab with no window.opener, so auth
        // can succeed before postMessage fails. Redirect if we're already signed in.
        if (auth.currentUser) {
          onUserLoginSuccess(auth.currentUser);
          showLoader();
          window.location.replace(REDIRECT_AFTER_LOGIN);
        }
        return;
      }
      if (err.code === 'auth/popup-blocked' ||
          err.code === 'auth/web-storage-unsupported' ||
          err.code === 'auth/operation-not-supported-in-this-environment') {
        showError("The sign-in popup was blocked.\nPlease allow popups for this site in your browser settings, then try again.");
        return;
      }
      handleAuthError(err);
    }
  });
}

// ── 7. FACEBOOK SIGN-IN ──────────────────────────────────────
if (facebookBtn) {
  facebookBtn.addEventListener("click", async () => {
    clearError();
    isSigningIn = true;

    const fbProvider = new FacebookAuthProvider();
    fbProvider.addScope("email");

    if (isInAppBrowser()) {
      isSigningIn = false;
      showError("Facebook sign-in doesn't work inside the Facebook app.\nTap the menu (⋮ or ···) and choose \"Open in browser\", then try again.");
      return;
    }

    if (isMobile() && isFirefoxBrowser()) {
      isSigningIn = false;
      showError("Facebook sign-in on Firefox mobile isn't supported.\nPlease open this page in Chrome or Safari and try again.");
      return;
    }

    if (isMobile()) {
      const redirectUri = window.location.origin + window.location.pathname;
      window.location.href =
        'https://www.facebook.com/dialog/oauth' +
        '?client_id=4017096908582533' +
        '&redirect_uri=' + encodeURIComponent(redirectUri) +
        '&scope=email' +
        '&response_type=token' +
        '&state=fb-mobile-auth';
      return;
    }

    try {
      const result = await signInWithPopup(auth, fbProvider);
      showLoader();
      await linkPendingCredential(result.user);

      let email = result.user.email;
      if (!email) {
        try {
          const snap = await findUserDocByUid(result.user.uid);
          if (snap) email = snap.data().email || null;
        } catch (_) {}
      }
      if (!email) {
        hideLoader();
        email = await collectMissingEmail();
        if (!email) {
          await signOut(auth);
          isSigningIn = false;
          showError("An email address is required to sign in with Facebook. Please try again.");
          return;
        }
        showLoader();
      }

      await saveUserProvider(result.user, email);
      try {
        const cached = localStorage.getItem("ak-user");
        if (cached) {
          const parsed = JSON.parse(cached);
          parsed.email = email;
          localStorage.setItem("ak-user", JSON.stringify(parsed));
        }
      } catch (_) {}
      localStorage.setItem("ak-userMail", email);
      try { await applySignupHotelReferral(email); } catch (_) {}
      onUserLoginSuccess(result.user);
      window.location.replace(REDIRECT_AFTER_LOGIN);

    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        isSigningIn = false;
        hideLoader();
        if (auth.currentUser) {
          onUserLoginSuccess(auth.currentUser);
          showLoader();
          window.location.replace(REDIRECT_AFTER_LOGIN);
        }
        return;
      }
      if (err.code === 'auth/popup-blocked' ||
          err.code === 'auth/web-storage-unsupported' ||
          err.code === 'auth/operation-not-supported-in-this-environment') {
        isSigningIn = false;
        hideLoader();
        showError("The sign-in popup was blocked.\nPlease allow popups for this site in your browser settings, then try again.");
        return;
      }
      isSigningIn = false;
      hideLoader();
      handleAuthError(err);
    }
  });
}

// ── 8. EMAIL / PASSWORD ──────────────────────────────────────

if (submitBtn) {
  submitBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    clearError();

    const email    = emailInput?.value.trim().toLowerCase();
    const password = passwordInput?.value;

    if (!email || !password) {
      showError("Please enter your email and password.");
      return;
    }

    if (!isValidEmail(email)) {
      showError("Please enter a valid email address.");
      return;
    }

    if (isSignUpMode && confirmPasswordInput) {
      if (password !== confirmPasswordInput.value) {
        showError("Passwords do not match.");
        return;
      }
    }

    isSigningIn = true;
    showLoader();
    try {
      let result;
      if (isSignUpMode) {
        result = await createUserWithEmailAndPassword(auth, email, password);
      }
      else {
        result = await signInWithEmailAndPassword(auth, email, password);
      }
      const linkedProvider = await linkPendingCredential(result.user);
      await saveUserProvider(result.user);
      if (linkedProvider) {
        showSuccess(`Your ${linkedProvider} account has been linked! Going forward, you can sign in with either ${linkedProvider} or your email and password.`);
        await new Promise(r => setTimeout(r, 4000));
      }

      try {
        if (localStorage.getItem("ak-hotel-referral")) {
          // Case 1: fresh referral link this session (sign-up flow).
          await applySignupHotelReferral(email);
        } else {
          console.log("no ak-hotel-referral in localStorage at submit time");
          // Case 2: returning user, opt-in surfaced via the debounced email
          // DB lookup while they were still typing into the login form.
          const snap = await getDoc(doc(db, "users", userDocId(email)));
          const existing = snap.exists() ? snap.data().hotelReferral : null;
          if (existing && !existing.optedIn && optInCheckbox && !optInCheckbox.hasAttribute("data-ak-hidden")) {
            await saveHotelReferral(email, existing.hotel, !!optInCheckbox.checked);
          }
        }
      } catch (_) {}

      onUserLoginSuccess(result.user);
      window.location.replace(REDIRECT_AFTER_LOGIN);
    }
    catch (err) {
      isSigningIn = false;
      hideLoader();
      if (err.code === "auth/email-already-in-use") {
        setMode(false);
        try {
          const methods = await fetchSignInMethodsForEmail(auth, email);
          const providerNames = {
            "google.com":   "Google",
            "facebook.com": "Facebook",
            "password":     "email and password",
          };
          const provider = providerNames[methods[0]] || "another method";
          showError(`Account already exists with ${provider}. Please sign in using that.`);
        } catch (_) {
          showError("Account already exists. Try signing in with Google or Facebook.");
        }
        return;
      }
      handleAuthError(err);
    }
  });
}

// ── 9. TOGGLE LOGIN ↔ SIGN UP ────────────────────────────────
if (signupLink) {
  signupLink.addEventListener("click", (e) => {
    e.preventDefault();
    setMode(!isSignUpMode);
  });
}

// Login mode has no localStorage signal to go on (the user may be on a new
// device, or already used/cleared it at sign-up), so once they've typed an
// email we look up their saved hotel-referral by email and show the opt-in
// only if it's still unconsented. Debounced off "input" (not "blur") so the
// lookup is already in flight/resolved well before they finish the password
// field and hit submit, instead of only firing once they tab away.
let hotelReferralLookupTimer = null;
if (emailInput) {
  emailInput.addEventListener("input", () => {
    clearTimeout(hotelReferralLookupTimer);
    hotelReferralLookupTimer = setTimeout(checkHotelReferralByEmail, 500);
  });
}

async function checkHotelReferralByEmail() {
  if (isSignUpMode || !optInCheckbox) return;
  if (localStorage.getItem("ak-hotel-referral")) return;
  const email = emailInput.value.trim();
  if (!email || !isValidEmail(email)) return;
  try {
    const snap = await getDoc(doc(db, "users", userDocId(email)));
    const referral = snap.exists() ? snap.data().hotelReferral : null;
    optInCheckbox.toggleAttribute("data-ak-hidden", !(referral && !referral.optedIn));
  } catch (_) {}
}

// ── 11. FORGOT PASSWORD ──────────────────────────────────────
function showForgotView() {
  if (loginFormWrap) loginFormWrap.classList.add("hide");
  if (forgotWrap)    forgotWrap.classList.remove("hide");
  clearError();
  if (successEl) successEl.classList.add("hide");
}

function showLoginView() {
  if (forgotWrap)    forgotWrap.classList.add("hide");
  if (loginFormWrap) loginFormWrap.classList.remove("hide");
  clearError();
  if (successEl) successEl.classList.add("hide");
}

if (forgotLink) {
  forgotLink.addEventListener("click", (e) => {
    e.preventDefault();
    if (forgotEmailInput && emailInput?.value.trim()) {
      forgotEmailInput.value = emailInput.value.trim();
    }
    showForgotView();
  });
}

if (forgotBackLink) {
  forgotBackLink.addEventListener("click", (e) => {
    e.preventDefault();
    showLoginView();
  });
}

if (forgotSubmitBtn) {
  forgotSubmitBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    clearError();
    if (successEl) successEl.classList.add("hide");

    const email = forgotEmailInput?.value.trim().toLowerCase();
    if (!email) { showError("Please enter your email address."); return; }
    if (!isValidEmail(email)) { showError("Please enter a valid email address."); return; }

    try {
      try {
        const snap = await getDoc(doc(db, "users", userDocId(email)));
        if (snap.exists()) {
          const provider = snap.data().provider;
          const providerNames = { "google.com": "Google", "facebook.com": "Facebook" };
          if (providerNames[provider]) {
            showError(`This account uses ${providerNames[provider]} to sign in. No password to reset.`);
            return;
          }
        }
      } catch (_) {
        // Firestore read failed (e.g. permission denied for unauthenticated user) — skip the check
      }
      await sendPasswordResetEmail(auth, email);
      showSuccess("Reset email sent! Check your inbox — and your spam folder if you don't see it.");
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        showLoginView();
        setMode(true);
        showError("No account found with that email\nPlease Sign Up");
      } else {
        showError("Something went wrong. Please try again.");
      }
    }
  });
}

// ── 12. REDIRECT ALREADY-LOGGED-IN USERS ────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  // Redirect flow fallback: onAuthStateChanged can fire before getRedirectResult
  // resolves, leaving isSigningIn=true and the user stranded on the login page.
  // If we came from a redirect and it hasn't been handled yet, handle it now.
  if (storedRedirectDest && !redirectHandled) {
    redirectHandled = true;
    isSigningIn = false;
    try { await saveUserProvider(user); } catch (_) {}
    onUserLoginSuccess(user);
    hideLoader();
    window.location.replace(storedRedirectDest);
    return;
  }

  // Redirect if nothing else has taken ownership. This handles:
  // - Already logged in on page load
  // - Popup-as-new-tab on mobile: auth completes in another tab, BroadcastChannel
  //   fires here before signInWithPopup resolves (it may never resolve)
  //
  // isSigningIn is only true in the second case (a button click started a flow
  // in this same tab), so gate the analytics event on it — otherwise every
  // plain page load for an already-logged-in user would fire "sign-in success".
  if (!redirectHandled) {
    redirectHandled = true;
    if (isSigningIn) onUserLoginSuccess(user);
    try { await saveUserProvider(user); } catch (_) {}
    showLoader();
    window.location.replace(REDIRECT_AFTER_LOGIN);
  }
});


