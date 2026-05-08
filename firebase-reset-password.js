// ============================================================
// FIREBASE PASSWORD RESET HANDLER FOR WEBFLOW
// Add these element IDs in Webflow Designer:
//
//   reset-password-new      → New password input
//   reset-password-confirm  → Confirm new password input
//   reset-submit            → Submit button
//   reset-form-wrap         → The form/wrapper (hidden on success/invalid)
//
// No Webflow elements needed for errors, success, or invalid —
// those are all injected by the script.
// ============================================================

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  verifyPasswordResetCode,
  confirmPasswordReset,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ── YOUR FIREBASE CONFIG ────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyBQPqbtlfHPLpB-JYbyxDZiugu4NqwpSeM",
  authDomain: "askkhonsu-map.firebaseapp.com",
  projectId: "askkhonsu-map",
  storageBucket: "askkhonsu-map.appspot.com",
  messagingSenderId: "266031876218",
  appId: "1:266031876218:web:ec93411f1c13d9731e93c3",
  measurementId: "G-Z7F4NJ4PHW"
};

// ── WHERE TO SEND USER AFTER RESET ──────────────────────────
const REDIRECT_AFTER_RESET = "/log-in";

// ── INIT ────────────────────────────────────────────────────
const app  = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

// ── READ URL PARAMS ─────────────────────────────────────────
const params  = new URLSearchParams(window.location.search);
const mode    = params.get("mode");
const oobCode = params.get("oobCode");

// ── ELEMENTS ────────────────────────────────────────────────
const newPasswordEl     = document.getElementById("reset-password-new");
const confirmPasswordEl = document.getElementById("reset-password-confirm");
const submitBtn         = document.getElementById("reset-submit");
const formWrap          = document.getElementById("reset-form-wrap");

// ── SPINNER CSS (injected once) ──────────────────────────────
const spinnerStyle = document.createElement("style");
spinnerStyle.textContent = `
  @keyframes _reset-spin { to { transform: rotate(360deg); } }
  ._reset-spinner {
    width: 28px; height: 28px; margin: 12px auto 0;
    border: 3px solid rgba(0,0,0,0.12);
    border-top-color: #6b7280;
    border-radius: 50%;
    animation: _reset-spin 0.8s linear infinite;
  }
`;
document.head.appendChild(spinnerStyle);

// ── POPUP (same pattern as firebase-auth.js) ─────────────────
function showPopup(msg, isError, duration) {
  const popupId = isError ? "reset-error-popup" : "reset-success-popup";
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
    textAlign: "center",
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

  // Spinner for non-error popups
  if (!isError) {
    const spinner = document.createElement("div");
    spinner.className = "_reset-spinner";
    card.appendChild(spinner);
  }

  backdrop.appendChild(card);
  document.body.appendChild(backdrop);

  if (duration) setTimeout(() => backdrop.remove(), duration);
}

function showError(msg)  { showPopup(msg, true, 5000); }
function clearError()    { document.getElementById("reset-error-popup")?.remove(); }

function hideLoader() {
  document.getElementById("reset-loader-overlay")?.remove();
}

function showLoader() {
  if (document.getElementById("reset-loader-overlay")) return;
  const overlay = document.createElement("div");
  overlay.id = "reset-loader-overlay";
  Object.assign(overlay.style, {
    position: "fixed", inset: "0",
    background: "rgba(255,255,255,0.5)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: "9999",
  });
  const spinner = document.createElement("div");
  spinner.className = "_reset-spinner";
  spinner.style.margin = "0";
  overlay.appendChild(spinner);
  document.body.appendChild(overlay);
}

// ── VALIDATE THE LINK ON PAGE LOAD ──────────────────────────
async function init() {
  if (mode !== "resetPassword" || !oobCode) {
    showLoader();
    window.location.replace(REDIRECT_AFTER_RESET);
    return;
  }

  try {
    await verifyPasswordResetCode(auth, oobCode);
    // Code is valid — form stays visible
  } catch {
    showInvalid();
  }
}

function showInvalid() {
  if (formWrap) formWrap.style.display = "none";

  // Show the expired-link popup for 2 minutes then redirect
  showPopup("This link has expired — request a new one.", false, 120000);
  setTimeout(() => { showLoader(); window.location.href = REDIRECT_AFTER_RESET; }, 120000);
}

// ── SUBMIT ───────────────────────────────────────────────────
if (submitBtn) {
  submitBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    clearError();

    const newPassword     = newPasswordEl?.value?.trim();
    const confirmPassword = confirmPasswordEl?.value?.trim();

    if (!newPassword || !confirmPassword) {
      showError("Please fill in both password fields.");
      return;
    }
    if (newPassword !== confirmPassword) {
      showError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      showError("Password must be at least 6 characters.");
      return;
    }

    submitBtn.disabled = true;
    showLoader();

    try {
      await confirmPasswordReset(auth, oobCode, newPassword);

      if (formWrap) formWrap.style.display = "none";

      hideLoader();
      showPopup("Password updated! Redirecting...", false, 3000);
      setTimeout(() => { showLoader(); window.location.href = REDIRECT_AFTER_RESET; }, 3000);
    } catch (err) {
      submitBtn.disabled = false;
      hideLoader();

      if (err.code === "auth/expired-action-code") {
        showError("This reset link has expired. Please request a new one.");
      } else if (err.code === "auth/invalid-action-code") {
        showError("This reset link is invalid or has already been used.");
      } else if (err.code === "auth/weak-password") {
        showError("Password is too weak. Use at least 6 characters.");
      } else {
        showError("Something went wrong. Please try again.");
      }
    }
  });
}

init();
