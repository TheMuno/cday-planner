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
import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
import {
  getAuth,
  signInWithPopup,
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
const TERMS_URL            = "/legal/terms";
const PRIVACY_URL          = "/legal/privacy";

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

let isSignUpMode = false;
let pendingCredential = null;
let isSigningIn = false;
let redirectHandled = false; // ensures only one sign-in flow (a button/form handler or the onAuthStateChanged backstop) finishes and navigates per sign-in

// ── DOUBLE-CLICK / CROSS-BUTTON GUARD ────────────────────────
// Deliberately separate from isSigningIn: isSigningIn is left true on purpose
// in the popup-race punt branches below (so the onAuthStateChanged backstop
// can still attribute analytics/opt-in correctly whenever it eventually
// fires, however long that takes) — it can legitimately stay true forever if
// the user simply closed the popup without ever signing in. Reusing it as a
// click-guard would permanently lock every button in that case. This flag
// instead auto-releases after a bounded timeout, so a genuinely-abandoned
// attempt never locks the page.
let authButtonsLocked = false;
let authButtonsLockTimer = null;

function lockAuthButtons() {
  authButtonsLocked = true;
  clearTimeout(authButtonsLockTimer);
  // Long enough that it won't fire mid-attempt on a real popup (2FA, a slow
  // network, an account picker), short enough that an abandoned attempt
  // doesn't leave the page feeling stuck for long.
  authButtonsLockTimer = setTimeout(() => { authButtonsLocked = false; }, 30000);
}

function unlockAuthButtons() {
  authButtonsLocked = false;
  clearTimeout(authButtonsLockTimer);
}

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
    lockAuthButtons();
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
            redirectHandled = false; // release the claim — signed back out, nothing left for the backstop to skip
            unlockAuthButtons();
            showError("An email address is required to sign in with Facebook. Please try again.");
            return;
          }
          showLoader();
        }
        await saveUserProvider(result.user, email);
        localStorage.setItem('ak-userMail', email);
        try { await promptHotelReferralOptIn(email); } catch (_) {}
        isSigningIn = false;
        onUserLoginSuccess(result.user);
        window.location.replace(REDIRECT_AFTER_LOGIN);
      } catch (err) {
        isSigningIn = false;
        redirectHandled = false;
        unlockAuthButtons();
        hideLoader();
        handleAuthError(err);
      }
    })();
  } else {
    const fbErr = _fbQuery.get('error_description') || _fbQuery.get('error');
    if (fbErr) showError('Facebook sign-in failed: ' + fbErr);
  }
}

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
  text.textContent = msg;
  Object.assign(text.style, {
    margin: "0", fontSize: window.innerWidth > 768 ? "17px" : "14px",
    color: isError ? "#dc2626" : "#16a34a",
    whiteSpace: "pre-line",
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

// existingEntry (the caller's already-fetched hotelReferrals[hotel], if any) is
// how createdAt survives repeat writes: the dot-path merge below replaces the
// *entire* value object at hotelReferrals.<hotel> each time, so createdAt has
// to be explicitly carried forward or it would silently vanish on write #2.
async function saveHotelReferral(email, hotel, optedIn, existingEntry) {
  try {
    // Dot-path key so merge:true only touches this one hotel's entry — a plain
    // { hotelReferrals: { [hotel]: {...} } } would replace the *entire*
    // hotelReferrals map and wipe out every other hotel's consent history.
    const value = {
      optedIn,
      updatedAt: serverTimestamp(),
      createdAt: existingEntry?.createdAt ?? serverTimestamp(), // set once, then only ever copied forward — never re-stamped
    };
    await setDoc(doc(db, "users", userDocId(email)), { [`hotelReferrals.${hotel}`]: value }, { merge: true });
    console.log("saveHotelReferral: write call resolved for", userDocId(email));
  } catch (err) {
    console.error("saveHotelReferral write failed:", err.code || err.message, err);
    throw err;
  }
}

// Multiple hotels can now have their own (possibly unconsented) entry in the
// same user's hotelReferrals map. Case 2 / submit only ever have one checkbox
// to show, so when more than one is unconsented, the most recently touched
// entry (by updatedAt) wins. Missing/unresolved updatedAt (e.g. a serverTimestamp
// not yet synced back from the server) sorts last rather than throwing.
function findUnconsentedHotel(hotelReferrals) {
  if (!hotelReferrals) return null;
  const unconsented = Object.entries(hotelReferrals).filter(([, v]) => !v.optedIn);
  if (!unconsented.length) return null;
  unconsented.sort(([, a], [, b]) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0));
  return unconsented[0][0];
}

// Returns a Promise resolving true (accepted) / false (declined — including
// dismissal via the backdrop, so it never hangs). Built from DOM nodes rather
// than innerHTML so the hotel name (sourced from localStorage or Firestore,
// not a hardcoded string) can never be interpreted as markup.
function showHotelReferralModal(hotel) {
  return new Promise((resolve) => {
    document.getElementById("auth-hotel-referral-popup")?.remove();

    const backdrop = document.createElement("div");
    backdrop.id = "auth-hotel-referral-popup";
    Object.assign(backdrop.style, {
      position: "fixed", inset: "0",
      background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: "9998",
    });

    const card = document.createElement("div");
    Object.assign(card.style, {
      background: "#fff", borderRadius: "8px",
      padding: "24px", maxWidth: "420px", width: "90%",
      boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
    });

    const msg = document.createElement("p");
    Object.assign(msg.style, { margin: "0 0 20px", fontSize: "14px", color: "#111", lineHeight: "1.5" });

    const hotelSpan = document.createElement("span");
    hotelSpan.textContent = formatHotelName(hotel);
    hotelSpan.style.fontWeight = "600";

    const termsLink = document.createElement("a");
    termsLink.href = TERMS_URL;
    termsLink.target = "_blank";
    termsLink.rel = "noopener";
    termsLink.textContent = "Terms of Service";
    Object.assign(termsLink.style, { color: "#ff7f34" });

    const privacyLink = document.createElement("a");
    privacyLink.href = PRIVACY_URL;
    privacyLink.target = "_blank";
    privacyLink.rel = "noopener";
    privacyLink.textContent = "Privacy Policy";
    Object.assign(privacyLink.style, { color: "#ff7f34" });

    msg.append(
      "Share my travel preferences with ", hotelSpan,
      " to unlock exclusive guest perks, arrival coordination, and personalized room preparation. " +
      "By accepting, you agree to our ", termsLink, " and ", privacyLink,
      ", and authorize Khonsu to share your trip details and email address with your host hotel to improve your stay."
    );

    const btnRow = document.createElement("div");
    Object.assign(btnRow.style, { display: "flex", gap: "10px" });

    const declineBtn = document.createElement("button");
    declineBtn.textContent = "Decline";
    Object.assign(declineBtn.style, {
      flex: "1", padding: "10px", background: "#f3f4f6", color: "#111",
      border: "none", borderRadius: "6px", fontSize: "14px", cursor: "pointer",
    });

    const acceptBtn = document.createElement("button");
    acceptBtn.textContent = "Accept";
    Object.assign(acceptBtn.style, {
      flex: "1", padding: "10px", background: "#ff7f34", color: "#fff",
      border: "none", borderRadius: "6px", fontSize: "14px", cursor: "pointer",
    });

    const finish = (result) => { backdrop.remove(); resolve(result); };
    declineBtn.addEventListener("click", () => finish(false));
    acceptBtn.addEventListener("click", () => finish(true));
    backdrop.addEventListener("click", (e) => { if (e.target === backdrop) finish(false); });

    btnRow.appendChild(declineBtn);
    btnRow.appendChild(acceptBtn);
    card.appendChild(msg);
    card.appendChild(btnRow);
    backdrop.appendChild(card);
    document.body.appendChild(backdrop);
  });
}

// Runs once per sign-in, right after auth succeeds and email is known — the
// same call for every provider (email/password, Google, Facebook popup,
// Facebook mobile redirect). Post-auth is what lets social-login users see
// this at all: pre-auth there's no typed email to key a DB lookup off of, but
// every provider gives us one by the time this runs.
//
// Which hotel to ask about: a fresh localStorage referral (this device just
// followed a referral link) takes priority; otherwise fall back to whichever
// hotel is unconsented in the user's own DB record (a returning user on a new
// device/browser with nothing in localStorage).
async function promptHotelReferralOptIn(email) {
  console.log("promptHotelReferralOptIn: called with", email);
  if (!email) return;
  let hotel = localStorage.getItem("ak-hotel-referral");
  let hotelReferrals;
  try {
    const docRef = doc(db, "users", userDocId(email));
    const snap = await getDoc(docRef);
    console.log("promptHotelReferralOptIn: read doc id =", docRef.path, "| exists =", snap.exists(), "| full data =", snap.exists() ? snap.data() : null);
    hotelReferrals = snap.exists() ? snap.data().hotelReferrals : null;
  } catch (err) {
    console.error("promptHotelReferralOptIn: getDoc failed:", err.code || err.message, err);
    return; // can't reach Firestore — don't block sign-in on this
  }
  console.log("promptHotelReferralOptIn: localStorage hotel =", hotel, "| hotelReferrals from db =", hotelReferrals);

  let existing;
  if (hotel) {
    existing = hotelReferrals?.[hotel] ?? null;
    if (existing?.optedIn) {
      localStorage.removeItem("ak-hotel-referral"); // already consented elsewhere — nothing left to ask
      return;
    }
  } else {
    hotel = findUnconsentedHotel(hotelReferrals);
    if (!hotel) {
      console.log("promptHotelReferralOptIn: no unconsented hotel found, nothing to show");
      return;
    }
    existing = hotelReferrals[hotel];
  }

  console.log("promptHotelReferralOptIn: showing modal for", hotel);
  hideLoader(); // no-op if it wasn't showing — only touched when the modal is actually about to appear
  const accepted = await showHotelReferralModal(hotel);
  showLoader();
  try {
    await saveHotelReferral(email, hotel, accepted, existing);
  } catch (_) {}
  if (accepted) localStorage.removeItem("ak-hotel-referral");
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
// redirect, email/password) right before we navigate away from /log-in.
// Header avatar rendering happens separately, on the
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
// Shared by the normal popup-resolves path and the popup-race recovery path
// below (auth/popup-closed-by-user firing even though auth.currentUser is
// already set) — both must run the exact same steps, or the recovery path
// silently skips saveUserProvider/promptHotelReferralOptIn.
async function finishGoogleSignIn(user) {
  console.log("finishGoogleSignIn: called for", user.email);
  await linkPendingCredential(user);
  await saveUserProvider(user);
  try { await promptHotelReferralOptIn(user.email); } catch (_) {}
  onUserLoginSuccess(user);
  window.location.replace(REDIRECT_AFTER_LOGIN);
}

if (googleBtn) {
  googleBtn.addEventListener("click", async () => {
    // Guard against a double-click on this button, or Google clicked while a
    // Facebook/email attempt is already in flight.
    if (authButtonsLocked) return;
    lockAuthButtons();
    clearError();
    isSigningIn = true;
    // Claim redirectHandled before the popup call, same reasoning as the
    // email/password handler: without this, the onAuthStateChanged backstop
    // can independently race the happy path here too and navigate away before
    // finishGoogleSignIn completes its writes.
    redirectHandled = true;
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      showLoader();
      await finishGoogleSignIn(result.user);
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        hideLoader();
        // On mobile the popup opens as a new tab with no window.opener, so auth
        // can succeed before postMessage fails. If it's already visible, finish
        // now; otherwise release the claim and leave isSigningIn=true —
        // auth.currentUser may just not have synced across tabs yet, and the
        // onAuthStateChanged listener at the bottom of this file will finish
        // the job once it does.
        if (auth.currentUser) {
          isSigningIn = false;
          unlockAuthButtons();
          showLoader();
          await finishGoogleSignIn(auth.currentUser);
        } else {
          redirectHandled = false;
          // Leave authButtonsLocked as-is: a background sign-in may still
          // complete via the onAuthStateChanged backstop, and its timeout is
          // the safety valve if it never does.
        }
        return;
      }
      isSigningIn = false;
      redirectHandled = false;
      unlockAuthButtons();
      hideLoader();
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
// Shared by the normal popup-resolves path and the popup-race recovery path
// below, same reasoning as finishGoogleSignIn — Facebook additionally needs
// the email-recovery steps (email scope can be denied) run on both paths too.
async function finishFacebookSignIn(user) {
  await linkPendingCredential(user);

  let email = user.email;
  if (!email) {
    try {
      const snap = await findUserDocByUid(user.uid);
      if (snap) email = snap.data().email || null;
    } catch (_) {}
  }
  if (!email) {
    hideLoader();
    email = await collectMissingEmail();
    if (!email) {
      await signOut(auth);
      isSigningIn = false;
      redirectHandled = false; // release the claim — signed back out, nothing left for the backstop to skip
      showError("An email address is required to sign in with Facebook. Please try again.");
      return;
    }
    showLoader();
  }

  await saveUserProvider(user, email);
  try {
    const cached = localStorage.getItem("ak-user");
    if (cached) {
      const parsed = JSON.parse(cached);
      parsed.email = email;
      localStorage.setItem("ak-user", JSON.stringify(parsed));
    }
  } catch (_) {}
  localStorage.setItem("ak-userMail", email);
  try { await promptHotelReferralOptIn(email); } catch (_) {}
  onUserLoginSuccess(user);
  window.location.replace(REDIRECT_AFTER_LOGIN);
}

if (facebookBtn) {
  facebookBtn.addEventListener("click", async () => {
    // Same double-click / cross-button guard as the Google handler above.
    // Locked further down, once the in-app-browser/Firefox early returns are
    // behind us — those show an error and bail without ever attempting a
    // sign-in, so they shouldn't leave the buttons locked.
    if (authButtonsLocked) return;
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
      lockAuthButtons();
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

    // Claim redirectHandled before the popup call — same reasoning as the
    // Google handler above. Placed here (not at the top of the click handler)
    // so the isInAppBrowser/Firefox/mobile-redirect early returns above never
    // need to release it themselves; they never reach this line.
    lockAuthButtons();
    redirectHandled = true;
    try {
      const result = await signInWithPopup(auth, fbProvider);
      showLoader();
      await finishFacebookSignIn(result.user);
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        hideLoader();
        // Same cross-tab sync race as the Google handler above — leave
        // isSigningIn=true when auth.currentUser isn't visible yet, and
        // release the claim so the onAuthStateChanged listener can finish the
        // job once it lands.
        if (auth.currentUser) {
          isSigningIn = false;
          unlockAuthButtons();
          showLoader();
          await finishFacebookSignIn(auth.currentUser);
        } else {
          redirectHandled = false;
          // Leave authButtonsLocked as-is — see the matching comment in the
          // Google handler above.
        }
        return;
      }
      isSigningIn = false;
      redirectHandled = false;
      unlockAuthButtons();
      hideLoader();
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

// ── 8. EMAIL / PASSWORD ──────────────────────────────────────

if (submitBtn) {
  submitBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    // Same double-click / cross-button guard as the Google/Facebook handlers.
    // Checked here, but only locked once validation passes below — an empty
    // field shouldn't lock the buttons for a sign-in attempt that never starts.
    if (authButtonsLocked) return;
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

    lockAuthButtons();
    isSigningIn = true;
    // Claim redirectHandled up front, synchronously, before the sign-in call
    // even starts. This flow never needs the onAuthStateChanged backstop (no
    // popup/redirect — everything happens in this tab), but onAuthStateChanged
    // can still fire before the await below resolves, and it would otherwise
    // race to call window.location.replace() before Case 2's lookup/write a
    // few lines down ever runs. Claiming early means that whenever the
    // listener fires, it always sees this already handled and stands down.
    redirectHandled = true;
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

      try { await promptHotelReferralOptIn(email); } catch (_) {}

      onUserLoginSuccess(result.user);
      window.location.replace(REDIRECT_AFTER_LOGIN);
    }
    catch (err) {
      isSigningIn = false;
      redirectHandled = false; // release the claim — this attempt failed, so a later one (this form or another sign-in method) must still be able to use the backstop
      unlockAuthButtons();
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
// This is the authoritative backstop for every "auth actually succeeded but
// the tab that requested it hasn't seen auth.currentUser yet" race — it fires
// whenever Firebase's cross-tab auth-state sync lands, however long that
// takes, so it (not a timeout in the click handlers) is what has to run the
// full set of post-sign-in steps. Missing any of these here is exactly what
// let user docs get saved without their hotelReferral: saveUserProvider alone
// writes a valid-looking doc, so the gap doesn't fail loudly, it just quietly
// drops the referral write.
onAuthStateChanged(auth, async (user) => {
  if (!user) return;

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
    const wasSigningIn = isSigningIn;
    console.log("onAuthStateChanged backstop: firing for", user.email, "| wasSigningIn =", wasSigningIn);
    if (wasSigningIn) onUserLoginSuccess(user);
    isSigningIn = false;
    try { await linkPendingCredential(user); } catch (_) {}
    try { await saveUserProvider(user); } catch (_) {}
    // Only decide the opt-in here if a sign-in actually happened in this tab
    // (wasSigningIn) — e.g. the popup-as-new-tab mobile race. If the user
    // merely landed on /log-in already authenticated from an earlier session,
    // don't silently record a "declined" opt-in before they've ever seen the
    // modal; leave the pending referral in localStorage so it's asked for
    // honestly the next time they actually sign in through this tab.
    if (wasSigningIn) {
      try { await promptHotelReferralOptIn(user.email); } catch (_) {}
    }
    showLoader();
    window.location.replace(REDIRECT_AFTER_LOGIN);
  }
});


