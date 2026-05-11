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

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  linkWithCredential,
  fetchSignInMethodsForEmail,
  sendPasswordResetEmail,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ── 1. YOUR FIREBASE CONFIG ─────────────────────────────────
// Replace these values with your project's config from:
// Firebase Console → Project Settings → Your Apps → SDK setup
const firebaseConfig = {
    apiKey: "AIzaSyBQPqbtlfHPLpB-JYbyxDZiugu4NqwpSeM",
    authDomain: "askkhonsu-map.firebaseapp.com",
    projectId: "askkhonsu-map",
    storageBucket: "askkhonsu-map.appspot.com",
    messagingSenderId: "266031876218",
    appId: "1:266031876218:web:ec93411f1c13d9731e93c3",
    measurementId: "G-Z7F4NJ4PHW"
};

// ── 2. WHERE TO SEND THE USER AFTER LOGIN ───────────────────
const REDIRECT_AFTER_LOGIN = localStorage.getItem('ak-login-redirect') || '/';

// ── 3. INIT ─────────────────────────────────────────────────
const app  = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

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

let isSignUpMode = false;
let pendingCredential = null;
let isSigningIn = false;

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
    margin: "0", fontSize: "14px",
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
    background: "rgba(255,255,255,0.5)",
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
      width: "100%", padding: "10px", background: "#111", color: "#fff",
      border: "none", borderRadius: "6px", fontSize: "14px", cursor: "pointer",
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

  if (err.code === "auth/popup-closed-by-user") {
    console.log("Sign-in popup closed by user.");
    return;
  }

  const messages = {
    "auth/user-not-found":       "No account found with that email.",
    "auth/wrong-password":       "Incorrect password.",
    "auth/invalid-credential":   "Incorrect email or password.",
    "auth/invalid-email":        "Please enter a valid email address.",
    "auth/email-already-in-use": "An account with this email already exists.",
    "auth/weak-password":        "Password must be at least 6 characters.",
  };
  showError(messages[err.code] || "Something went wrong. Please try again.");
}

async function saveUserProvider(user, emailOverride) {
  const provider = user.providerData[0]?.providerId || "password";
  await setDoc(doc(db, "users", user.uid), {
    email:    emailOverride || user.email,
    provider,
    displayName: user.displayName || null,
  }, { merge: true });
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
      window.location.replace(REDIRECT_AFTER_LOGIN);
    } catch (err) {
      isSigningIn = false;
      hideLoader();
      handleAuthError(err);
    }
  });
}

// ── 7. FACEBOOK SIGN-IN ──────────────────────────────────────
if (facebookBtn) {
  facebookBtn.addEventListener("click", async () => {
    clearError();
    isSigningIn = true;
    try {
      const fbProvider = new FacebookAuthProvider();
      fbProvider.addScope("email");
      const result = await signInWithPopup(auth, fbProvider);
      showLoader();
      await linkPendingCredential(result.user);

      let email = result.user.email;

      if (!email) {
        // Returning user may already have an email saved in Firestore
        try {
          const snap = await getDoc(doc(db, "users", result.user.uid));
          if (snap.exists()) email = snap.data().email || null;
        } catch (_) {}
      }

      if (!email) {
        // Facebook didn't provide an email — ask the user for it
        hideLoader();
        email = await collectMissingEmail();
        if (!email) {
          // User cancelled — sign them out and let them try again
          await signOut(auth);
          isSigningIn = false;
          showError("An email address is required to sign in with Facebook. Please try again.");
          return;
        }
        showLoader();
      }

      await saveUserProvider(result.user, email);
      window.location.replace(REDIRECT_AFTER_LOGIN);
    } catch (err) {
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

    console.log('Sign-Up Btn Clicked!!!')

    const email    = emailInput?.value.trim();
    const password = passwordInput?.value;

    if (!email || !password) {
      showError("Please enter your email and password.");
      return;
    }

    if (!isValidEmail(email)) {
      showError("Please enter a valid email address.");
      return;
    }

    console.log('isSignUpMode::', isSignUpMode)

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

    const email = forgotEmailInput?.value.trim();
    if (!email) { showError("Please enter your email address."); return; }
    if (!isValidEmail(email)) { showError("Please enter a valid email address."); return; }

    try {
      try {
        const snap = await getDocs(query(collection(db, "users"), where("email", "==", email)));
        if (!snap.empty) {
          const provider = snap.docs[0].data().provider;
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
        showError("No account found with that email.");
      } else {
        showError("Something went wrong. Please try again.");
      }
    }
  });
}

// ── 12. REDIRECT ALREADY-LOGGED-IN USERS ────────────────────
onAuthStateChanged(auth, (user) => {
  if (user && !isSigningIn) {
    showLoader("Already logged in...");
    window.location.replace(REDIRECT_AFTER_LOGIN);
  }
});


