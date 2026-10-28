/**
 * solvang-pdf.js
 * Add as a <script type="module"> embed on the King Frederik Inn site (kingfrederikinn.askkhonsu.com),
 * page settings → Before </body>.
 *
 * Webflow attributes used:
 *   data-ak="solvang-pdf"       — button(s) that download the guest's Solvang Smart Guide PDF; shown
 *                                  on load even if Webflow has them hidden (the guide is free).
 *                                  Use a button of its own: data-ak holds one value, so putting this
 *                                  on another script's button (e.g. download-google-maps-btn)
 *                                  replaces that one's value and unhooks it from that script.
 *   data-ak="popup-action-label" — optional text label inside the button; only it is swapped for
 *                                  the spinner, so the button's own styling stays intact
 *
 * The guide is free for the hotel's guests, but they must be signed in: the Cloud Function
 * (generateSolvangSmartGuidePdf) only builds the guide for the signed-in guest's own trip.
 */

import { initializeApp, getApps, getApp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFunctions, httpsCallable }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js";

const firebaseConfig = {
  apiKey: "AIzaSyBQPqbtlfHPLpB-JYbyxDZiugu4NqwpSeM",
  authDomain: "askkhonsu-map.firebaseapp.com",
  projectId: "askkhonsu-map",
  storageBucket: "askkhonsu-map.appspot.com",
  messagingSenderId: "266031876218",
  appId: "1:266031876218:web:ec93411f1c13d9731e93c3",
};

const app       = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth      = getAuth(app);
const functions = getFunctions(app);

const FUNCTION_NAME    = "generateSolvangSmartGuidePdf";
const DEFAULT_FILENAME = "solvang-smart-guide.pdf";

let currentUser = null;
// Resolves on Firebase's first sign-in check, so a click that comes before it (the buttons now show
// as soon as the page is parsed) waits for it rather than telling a signed-in guest to sign in.
let resolveAuthChecked;
const authChecked = new Promise(resolve => { resolveAuthChecked = resolve; });
onAuthStateChanged(auth, user => { currentUser = user; resolveAuthChecked(); });

// Set up straight away rather than on window "load": a module script runs once the HTML is parsed,
// so the buttons already exist, while "load" waits on every image and font (about 10s on the
// download page), leaving the buttons hidden and dead until then.
(() => {
  const $buttons = document.querySelectorAll('[data-ak="solvang-pdf"]');
  if (!$buttons.length) return;

  // Download buttons start hidden in Webflow (data-ak-hidden or an inline display:none) and
  // stripe-purchase.js only reveals the ones it knows by their own data-ak value. This guide is
  // free, so its buttons are always shown.
  $buttons.forEach(btn => {
    btn.removeAttribute('data-ak-hidden');
    btn.style.display = '';
  });

  const getLabelEl = btn => btn.querySelector('[data-ak="popup-action-label"]') || btn;
  let isLoading = false;

  $buttons.forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      // Awaited first, so two quick clicks can't both pass the isLoading check below.
      await authChecked;
      if (isLoading) return;
      if (!currentUser) {
        showMessage("Please sign in to download your Solvang guide.");
        return;
      }
      isLoading = true;
      injectSpinnerStyle();

      // Only the clicked button shows the spinner; the others are just disabled.
      const originals = Array.from($buttons).map(b => getLabelEl(b).innerHTML);
      $buttons.forEach(b => { b.disabled = true; });
      btn.style.minWidth = `${btn.getBoundingClientRect().width}px`;
      getLabelEl(btn).innerHTML = `<span class="ak-pdf-btn-loading"><span class="ak-pdf-spinner"></span>Creating Guide...</span>`;

      try {
        const generateGuide = httpsCallable(functions, FUNCTION_NAME, { timeout: 300000 });
        const { data } = await generateGuide({ userId: `user-${currentUser.email}` });

        const bytes = Uint8Array.from(atob(data.pdf), c => c.charCodeAt(0));
        const url   = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
        const a     = document.createElement("a");
        a.href      = url;
        a.download  = data.filename || DEFAULT_FILENAME;
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error("Solvang guide download error:", err);
        showDownloadError(err);
      } finally {
        isLoading = false;
        $buttons.forEach((b, i) => { b.disabled = false; getLabelEl(b).innerHTML = originals[i]; });
        btn.style.minWidth = "";
      }
    });
  });
})();

// Callable errors arrive as 'functions/<code>'. Only failed-precondition messages (empty itinerary)
// are written for guests and shown as-is; every other code gets copy written here.
function showDownloadError(err) {
  const SUPPORT = "If this keeps happening, email hello@askkhonsu.com.";
  const code = (err?.code || "").replace(/^functions\//, "");
  let message;
  if (!navigator.onLine) {
    message = "You're offline — please check your internet connection and try again.";
  } else if (code === "failed-precondition" && err.message) {
    message = err.message;
  } else if (code === "unauthenticated" || code === "permission-denied") {
    message = "Your session has expired. Please sign in again to download your guide.";
  } else if (code === "not-found") {
    message = "We couldn't find your saved trip. Build and save your itinerary, then download your guide.";
  } else if (code === "deadline-exceeded" || code === "unavailable") {
    message = "Your guide took too long to build. Please try again in a moment.";
  } else {
    message = `Something went wrong creating your guide. Please try again. ${SUPPORT}`;
  }
  showMessage(message);
}

// alertify is a classic <script> on the page; fall back to alert() if it didn't load.
function showMessage(message) {
  if (window.alertify?.alert) window.alertify.alert(message);
  else alert(message);
}

function injectSpinnerStyle() {
  if (document.getElementById("ak-pdf-spinner-style")) return;
  const style = document.createElement("style");
  style.id = "ak-pdf-spinner-style";
  style.textContent = `
    @keyframes ak-pdf-spin { to { transform: rotate(360deg); } }
    .ak-pdf-spinner {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid currentColor;
      border-top-color: transparent;
      border-radius: 50%;
      animation: ak-pdf-spin 0.7s linear infinite;
      opacity: 0.8;
      flex-shrink: 0;
    }
    .ak-pdf-btn-loading {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
  `;
  document.head.appendChild(style);
}
