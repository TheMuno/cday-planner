/**
 * stripe-purchase.js
 * Add as a <script type="module"> embed in Webflow (page settings → Before </body>).
 *
 * Webflow attributes managed by this script:
 *   data-ak="buy-plan"       — checkout trigger buttons (hidden after purchase)
 *   data-ak-pre-purchase     — any non-interactive element shown before purchase, hidden after
 *   data-ak-post-purchase    — any element revealed after purchase
 *   data-ak-download-guide   — download button(s) revealed after purchase
 *   data-ak="download-flagship-smart-guide" — flagship smart guide download button(s), revealed after purchase
 *
 * All elements are queried after window.load so Webflow has fully rendered the page.
 *
 * Cross-script purchase status (for other scripts on the same page, e.g. calculate-pass-savings.js):
 *   localStorage['ak-has-purchased-plan']  — 'true' | 'false', cached for future page loads
 *   window event 'ak:purchase-status'      — { detail: { purchased } }, fired the moment status
 *                                             is known during THIS page load (localStorage alone
 *                                             can't tell you when the async check has finished)
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

// firebase-firestore.js is only actually needed once the purchase check below runs. As a
// static import it used to be fetched — and block evaluation of this entire module, including
// the onAuthStateChanged registration inside DOMContentLoaded, before any code here could run
// at all. This script is a sitewide embed (also loaded on pages like build-itinerary), and
// module scripts execute in document order like defer scripts — so this alone was enough to
// re-delay build-itinerary.js's own sign-in-to-save button behind stripe-purchase's Firestore
// fetch, even though build-itinerary.js's own Firestore import was already made lazy for
// exactly this reason. Loading it lazily here too removes that cross-script dependency.
let dbPromise = null;
function getDb() {
  if (!dbPromise) {
    dbPromise = import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js").then(mod => {
      // Long-polling avoids ad blockers / proxies that kill the default WebChannel streaming
      // connection, which is what causes "Could not reach Cloud Firestore backend" timeouts.
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

const PURCHASE_STORAGE_KEY = 'ak-has-purchased-plan';
const PURCHASE_EVENT       = 'ak:purchase-status';

// Lets other scripts on the same page (e.g. calculate-pass-savings.js) react to purchase
// status without running their own Firestore read: localStorage for the cached value on
// future loads, a custom event for the current load since it fires before any write lands.
function broadcastPurchaseStatus(purchased, { persist = true } = {}) {
  if (persist) localStorage.setItem(PURCHASE_STORAGE_KEY, purchased ? 'true' : 'false');
  window.dispatchEvent(new CustomEvent(PURCHASE_EVENT, { detail: { purchased } }));
}

// Shared with calculate-pass-savings.js: buy-plan and attractions-on-passes each run their own
// async check, but should appear together — whichever finishes last reveals both. Keys for parts
// not present on the current page are dropped immediately so the other party never waits on them.
function akRegisterReveal(key, reveal) {
  const sync = window.akRevealSync || (window.akRevealSync = { pending: new Set(['attractions', 'buyPlan']), reveals: {}, fired: false });
  // Already revealed once (e.g. a later setUI() call from pollForPurchase) — just run this
  // one's own update, don't re-queue and re-fire the other party's stale callback.
  if (sync.fired) { reveal(); return; }
  if (!document.querySelector('[data-ak="attractions-on-passes"]')) sync.pending.delete('attractions');
  if (!document.querySelector('[data-ak="buy-plan"]')) sync.pending.delete('buyPlan');
  sync.reveals[key] = reveal;
  sync.pending.delete(key);
  if (sync.pending.size === 0) {
    sync.fired = true;
    Object.values(sync.reveals).forEach(fn => fn());
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const $buyButtons      = document.querySelectorAll('[data-ak="buy-plan"]');
  const $downloadBtns    = document.querySelectorAll('[data-ak-download-guide]');
  const $flagshipDownloadBtns = document.querySelectorAll('[data-ak="download-flagship-smart-guide"]');
  const $downloadMapsBtns = document.querySelectorAll('[data-ak="download-google-maps-btn"]');
  const $prePurchaseEls  = document.querySelectorAll('[data-ak-pre-purchase]');
  const $postPurchaseEls = document.querySelectorAll('[data-ak-post-purchase]');


  // Optimistic paint: a returning purchased user already has this cached from a prior page
  // load, so show their download buttons immediately instead of making them wait through a
  // fresh auth + Firestore round-trip just to see a button they're entitled to every time.
  // Click handlers still only get wired once the real check below confirms it — and if the
  // cache turns out stale (e.g. a refund), setUI(false) further down hides these again.
  if (localStorage.getItem(PURCHASE_STORAGE_KEY) === 'true') {
    [...$downloadBtns, ...$flagshipDownloadBtns, ...$downloadMapsBtns].forEach(el => {
      el.removeAttribute('data-ak-hidden');
      el.style.display = '';
    });
  }

  // Show spinners immediately while auth + Firestore check runs
  showSpinners($buyButtons);

  // Fail-safe: force spinners off after 8s even if the combined reveal (below) never fires —
  // e.g. attractions-on-passes' own sheet fetch hangs indefinitely.
  const spinnerTimeout = setTimeout(removeSpinners, 8000);

  // Hoisted out of the try block so the catch below can still wire the buy buttons for a user
  // whose auth resolved fine but whose Firestore purchase check then failed/timed out.
  let user;
  try {
    user = await new Promise(resolve => onAuthStateChanged(auth, resolve));

    if (!user) {
      setUI(false);
      broadcastPurchaseStatus(false);
      wireBuyButtonsLoggedOut($buyButtons);
      return;
    }

    const { doc, getDoc, db } = await getDb();
    const userRef   = doc(db, 'locationsData', `user-${user.email}`);
    const userSnap  = await withTimeout(getDoc(userRef), 8000, 'Firestore purchase check timed out');
    const userData  = userSnap.exists() ? userSnap.data() : {};
    const purchased = userData.hasPurchasedPlan === true;

    if (purchased) {
      const plan = userData.planDetails || {};
      if (plan.amountPaid)  localStorage.setItem('ak-sm-price', plan.amountPaid);
      if (plan.name)        localStorage.setItem('ak-sm-name',  plan.name);
      if (plan.description) localStorage.setItem('ak-sm-desc',  plan.description);
    }

    setUI(purchased);
    broadcastPurchaseStatus(purchased);

    const isPurchaseReturn = new URLSearchParams(window.location.search).get('purchase') === 'success';
    if (isPurchaseReturn) {
      const params = new URLSearchParams(window.location.search);
      params.delete('purchase');
      const clean = params.toString();
      history.replaceState(null, '', window.location.pathname + (clean ? '?' + clean : ''));
    }

    if (isPurchaseReturn && purchased) {
      fireConversionPixel(userData.planDetails?.amountPaid);
    }

    if (!purchased && isPurchaseReturn) {
      pollForPurchase(user, $buyButtons, $downloadBtns, $downloadMapsBtns, $postPurchaseEls, $flagshipDownloadBtns);
      return;
    }

    if (!purchased) {
      wireBuyButtons(user, $buyButtons);
    } else {
      wireDownloadButton(user, $downloadBtns);
      wireDownloadButton(user, $flagshipDownloadBtns, 'generateFlagshipSmartGuidePdf', 'flagship-smart-guide.pdf');
      wireGoogleMapsButton($downloadMapsBtns);
    }
  } catch (err) {
    console.error('Purchase check failed:', err);
    // Can't confirm purchase status (Firestore unreachable/timed out) — degrade to the
    // not-purchased UI instead of leaving buy-plan/pre-purchase stuck hidden forever.
    // persist:false — don't clobber a previously cached "true" with an unconfirmed "false".
    setUI(false);
    broadcastPurchaseStatus(false, { persist: false });
    // Without this, setUI(false) reveals the buy button but nothing ever wires its click
    // handler, so it just sits there dead. Only reachable when auth resolved but the
    // Firestore check itself failed — a still-unresolved `user` means wireBuyButtonsLoggedOut()
    // already ran (and returned) before this could ever throw.
    if (user) wireBuyButtons(user, $buyButtons);
  }

  function withTimeout(promise, ms, message) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
    ]);
  }

  function wireBuyButtonsLoggedOut($buyButtons) {
    $buyButtons.forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        window.location.href = '/log-in';
      });
    });
  }

  function fireConversionPixel(value) {
    if (typeof gtag !== 'function') return;
    gtag('event', 'smart_guide_purchase', {
      value:    value ? parseFloat(value) : 0,
      currency: 'USD',
    });
  }

  function setUI(purchased) {
    const onUpgradePage = window.location.pathname === '/upgrade';

    akRegisterReveal('buyPlan', () => {
      // Spinners come down here, not as soon as this file's own auth/Firestore check settles —
      // attractions-on-passes (calculate-pass-savings.js) can still be waiting on its own sheet
      // fetch at that point, and removing the spinner early leaves a gap where it's gone but the
      // box it was covering for is still hidden.
      clearTimeout(spinnerTimeout);
      removeSpinners();

      $buyButtons.forEach(btn => {
        if (purchased) {
          if (onUpgradePage) {
            btn.textContent = 'Thanks for purchasing Smart Guide';
            btn.disabled = true;
          } else {
            btn.setAttribute('data-ak-hidden', '');
          }
        } else {
          btn.removeAttribute('data-ak-hidden');
        }
      });
    });

    $prePurchaseEls.forEach(el => {
      if (purchased) {
        el.setAttribute('data-ak-hidden', '');
      } else {
        el.removeAttribute('data-ak-hidden');
        el.style.display = ''; // clear any Webflow inline display:none
      }
    });

    $postPurchaseEls.forEach(el => {
      if (purchased) {
        el.removeAttribute('data-ak-hidden');
        el.style.display = ''; // clear any Webflow inline display:none
      } else {
        el.setAttribute('data-ak-hidden', '');
      }
    });

    $downloadBtns.forEach(btn => {
      if (purchased) {
        btn.removeAttribute('data-ak-hidden');
        btn.style.display = ''; // clear any Webflow inline display:none
      } else {
        btn.setAttribute('data-ak-hidden', '');
      }
    });

    $flagshipDownloadBtns.forEach(btn => {
      if (purchased) {
        btn.removeAttribute('data-ak-hidden');
        btn.style.display = ''; // clear any Webflow inline display:none
      } else {
        btn.setAttribute('data-ak-hidden', '');
      }
    });

    $downloadMapsBtns.forEach(btn => {
      if (purchased) {
        btn.removeAttribute('data-ak-hidden');
        btn.style.display = ''; // clear any Webflow inline display:none
      } else {
        btn.setAttribute('data-ak-hidden', '');
      }
    });
  }

  function wireBuyButtons(user, $buyButtons) {
    let isLoading = false;
    // Captured once, up front — not inside the click handler — so the bfcache
    // restore below (which can fire without ever re-running this function) has
    // the pre-click content to restore to.
    const originals = Array.from($buyButtons).map(b => b.innerHTML);

    // Back-button restore: window.location.href = data.url below navigates to
    // Stripe, but hitting "back" from there often restores this page from
    // bfcache instead of re-running wireBuyButtons — so without this, the
    // button would come back stuck showing "Processing..." and disabled.
    // event.persisted is true only on that bfcache restore, never on the
    // initial forward navigation, so this can't interfere with the redirect itself.
    window.addEventListener('pageshow', (e) => {
      if (!e.persisted || !isLoading) return;
      isLoading = false;
      $buyButtons.forEach((b, i) => {
        b.disabled = false;
        b.innerHTML = originals[i];
        b.style.minWidth = '';
      });
    });

    $buyButtons.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (isLoading) return;
        isLoading = true;

        // Only the clicked button shows the spinner/text; the rest are just
        // disabled so a second checkout can't be started mid-flight.
        $buyButtons.forEach(b => { b.disabled = true; });
        btn.style.minWidth = `${btn.getBoundingClientRect().width}px`;
        btn.innerHTML = `
          <div style="display:inline-flex;align-items:center;justify-content:center;gap:8px;">
            <div style="width:14px;height:14px;border:2px solid rgba(255,255,255,0.4);border-top-color:currentColor;border-radius:50%;animation:ak-spin 0.7s linear infinite;flex-shrink:0;"></div>
            <span>Processing...</span>
          </div>`;

        // itinerary-list now requires a shareToken (not a raw email) to load — mint/reuse the
        // caller's own token so the post-checkout redirect lands on a working link. This is
        // purely cosmetic for the redirect URL, so its own failure (network blip, cold start)
        // must never block the actual checkout below — isolated in its own try/catch instead
        // of sharing the one around createPlanCheckout.
        let shareToken = null;
        if (window.location.pathname === '/itinerary-list') {
          try {
            const getMyShareToken = httpsCallable(functions, 'getMyShareToken');
            shareToken = (await getMyShareToken()).data.shareToken;
          } catch (err) {
            console.error('getMyShareToken failed, continuing without it:', err);
          }
        }

        try {
          const createPlanCheckout = httpsCallable(functions, 'createPlanCheckout');
          const { data } = await createPlanCheckout({
            userEmail:  user.email,
            successUrl: (() => {
              const base = window.location.origin + window.location.pathname + '?purchase=success';
              return base + (shareToken ? '&token=' + encodeURIComponent(shareToken) : '');
            })(),
            cancelUrl: (() => {
              const base = window.location.origin + window.location.pathname;
              return base + (shareToken ? '?token=' + encodeURIComponent(shareToken) : '');
            })(),
          });
          window.location.href = data.url;
        } catch (err) {
          console.error('Checkout error:', err);
          isLoading = false;
          $buyButtons.forEach((b, i) => {
            b.disabled = false;
            b.innerHTML = originals[i];
            b.style.minWidth = '';
          });
        }
      });
    });
  }

  function injectPdfSpinnerStyle() {
    if (document.getElementById('ak-pdf-spinner-style')) return;
    const style = document.createElement('style');
    style.id = 'ak-pdf-spinner-style';
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

  function wireDownloadButton(user, $downloadBtns, functionName = 'generateAdvancedItineraryPdf', defaultFilename = 'smart-guide.pdf') {
    if (!$downloadBtns.length) return;

    const $itineraryWrap = document.querySelector('[data-ak="itinerary-list"]');
    let isLoading = false;

    // [data-ak-download-guide] is a Webflow component wrapper (.btn_main_wrap
    // carries the button's background/border) around a text label
    // ([data-ak="popup-action-label"]) — swapping the whole button's
    // innerHTML wipes .btn_main_wrap out, leaving a bare spinner+text with no
    // button chrome. Swap just the label instead so the chrome stays intact.
    const getLabelEl = btn => btn.querySelector('[data-ak="popup-action-label"]') || btn;

    $downloadBtns.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (isLoading) return;
        isLoading = true;

        injectPdfSpinnerStyle();

        // Only the clicked button shows the spinner/text; the rest are just
        // disabled so a second PDF generation can't be started mid-flight.
        const originals = Array.from($downloadBtns).map(b => getLabelEl(b).innerHTML);
        $downloadBtns.forEach(b => { b.disabled = true; });
        btn.style.minWidth = `${btn.getBoundingClientRect().width}px`;
        getLabelEl(btn).innerHTML = `<span class="ak-pdf-btn-loading"><span class="ak-pdf-spinner"></span>Creating Guide...</span>`;
        $itineraryWrap?.classList.add('disable');

        try {
          const generateGuide = httpsCallable(functions, functionName, { timeout: 120000 });
          const { data } = await generateGuide({ userId: `user-${user.email}` });

          const bytes = Uint8Array.from(atob(data.pdf), c => c.charCodeAt(0));
          const blob  = new Blob([bytes], { type: 'application/pdf' });
          const url   = URL.createObjectURL(blob);
          const a     = document.createElement('a');
          a.href      = url;
          a.download  = data.filename || defaultFilename;
          a.click();
          URL.revokeObjectURL(url);
        } catch (err) {
          console.error('Download error:', err);
        } finally {
          isLoading = false;
          $downloadBtns.forEach((b, i) => { b.disabled = false; getLabelEl(b).innerHTML = originals[i]; });
          btn.style.minWidth = '';
          $itineraryWrap?.classList.remove('disable');
        }
      });
    });
  }

  function wireGoogleMapsButton($downloadMapsBtns) {
    if (!$downloadMapsBtns.length) return;
    window.akWireGoogleMapsBtn?.($downloadMapsBtns);
  }

  function showSpinners($postPurchaseEls) {
    if (!$postPurchaseEls.length) return;
    if (!document.querySelector('#ak-spinner-style')) {
      const style = document.createElement('style');
      style.id = 'ak-spinner-style';
      style.textContent = `
        @keyframes ak-spin { to { transform: rotate(360deg); } }
        @keyframes ak-typing-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }

    const onUpgradePage = window.location.pathname === '/upgrade';

    if (onUpgradePage) {
      $postPurchaseEls.forEach(el => {
        el.dataset.akOriginalHtml = el.innerHTML;
        el.disabled = true;
        el.innerHTML = `
          <div style="display:inline-flex;align-items:center;justify-content:center;gap:8px;">
            <div style="width:14px;height:14px;border:2px solid rgba(255,255,255,0.4);border-top-color:currentColor;border-radius:50%;animation:ak-spin 0.7s linear infinite;flex-shrink:0;"></div>
            <span>Processing...</span>
          </div>`;
      });
      return;
    }

    const makeSpinner = () => {
      const spinner = document.createElement('div');
      spinner.setAttribute('data-ak-spinner', '');
      spinner.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:10px;padding:16px 0;';
      spinner.innerHTML = `
        <div style="width:18px;height:18px;border:2px solid #e0e0e0;border-top-color:#555;border-radius:50%;animation:ak-spin 0.7s linear infinite;flex-shrink:0;"></div>
      `;
      return spinner;
    };

    // attractions-on-passes gets the typing-dots treatment; every other buy-plan spinner keeps
    // the plain rotating circle above.
    const makeTypingDotsSpinner = () => {
      const spinner = document.createElement('div');
      spinner.setAttribute('data-ak-spinner', '');
      spinner.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:5px;padding:16px 0;';
      const dotStyle = 'width:6px;height:6px;border-radius:50%;background:#B0ADA6;animation:ak-typing-bounce 1.2s infinite ease-in-out;';
      spinner.innerHTML = `
        <div style="${dotStyle}"></div>
        <div style="${dotStyle}animation-delay:0.15s;"></div>
        <div style="${dotStyle}animation-delay:0.3s;"></div>
      `;
      return spinner;
    };

    $postPurchaseEls.forEach(el => {
      // This particular buy-plan button lives in the same section as attractions-on-passes — its
      // own spinner would be redundant with the one below, so skip it here.
      if (el.hasAttribute('data-ak-pass-attractons')) return;
      el.parentNode.insertBefore(makeSpinner(), el);
    });

    // attractions-on-passes has its own async check (populateOnPassTickets in
    // calculate-pass-savings.js) independent of the buy-plan check above — give its section a
    // spinner too, in place of the one skipped on its buy-plan button.
    const $attractionsOnPasses = document.querySelector('[data-ak="attractions-on-passes"]');
    if ($attractionsOnPasses) $attractionsOnPasses.parentNode.insertBefore(makeTypingDotsSpinner(), $attractionsOnPasses);
  }

  function removeSpinners() {
    document.querySelectorAll('[data-ak-spinner]').forEach(el => el.remove());

    if (window.location.pathname === '/upgrade') {
      $buyButtons.forEach(btn => {
        if (btn.dataset.akOriginalHtml !== undefined) {
          btn.innerHTML = btn.dataset.akOriginalHtml;
          btn.disabled = false;
          delete btn.dataset.akOriginalHtml;
        }
      });
    }
  }

  async function pollForPurchase(user, $buyButtons, $downloadBtns, $downloadMapsBtns, $postPurchaseEls, $flagshipDownloadBtns, attempts = 0) {
    if (attempts >= 10) return;

    await new Promise(r => setTimeout(r, 1000));

    let userSnap, purchased;
    try {
      const { doc, getDoc, db } = await getDb(); // already resolved by the first check — instant here
      userSnap  = await getDoc(doc(db, 'locationsData', `user-${user.email}`));
      purchased = userSnap.exists() && userSnap.data().hasPurchasedPlan === true;
    } catch (err) {
      console.error('pollForPurchase check failed:', err);
      // A transient Firestore error here would otherwise throw inside this unawaited recursive
      // call and silently kill the whole poll loop — a user who just paid could be stuck on the
      // pre-purchase UI until they manually reload. Retry instead, same as a not-yet-purchased result.
      pollForPurchase(user, $buyButtons, $downloadBtns, $downloadMapsBtns, $postPurchaseEls, $flagshipDownloadBtns, attempts + 1);
      return;
    }

    if (purchased) {
      const userData = userSnap.data();
      const plan = userData.planDetails || {};
      if (plan.amountPaid)  localStorage.setItem('ak-sm-price', plan.amountPaid);
      if (plan.name)        localStorage.setItem('ak-sm-name',  plan.name);
      if (plan.description) localStorage.setItem('ak-sm-desc',  plan.description);

      fireConversionPixel(plan.amountPaid);
      setUI(true);
      broadcastPurchaseStatus(true);
      wireDownloadButton(user, $downloadBtns);
      wireDownloadButton(user, $flagshipDownloadBtns, 'generateFlagshipSmartGuidePdf', 'flagship-smart-guide.pdf');
      wireGoogleMapsButton($downloadMapsBtns);
      history.replaceState(null, '', window.location.pathname);
    } else {
      pollForPurchase(user, $buyButtons, $downloadBtns, $downloadMapsBtns, $postPurchaseEls, $flagshipDownloadBtns, attempts + 1);
    }
  }
});
