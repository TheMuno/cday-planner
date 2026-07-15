/**
 * stripe-purchase.js
 * Add as a <script type="module"> embed in Webflow (page settings → Before </body>).
 *
 * Webflow attributes managed by this script:
 *   data-ak="buy-plan"       — checkout trigger buttons (hidden after purchase)
 *   data-ak-pre-purchase     — any non-interactive element shown before purchase, hidden after
 *   data-ak-post-purchase    — any element revealed after purchase
 *   data-ak-download-guide   — download button(s) revealed after purchase
 *
 * All elements are queried after window.load so Webflow has fully rendered the page.
 */

import { initializeApp, getApps, getApp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, getDoc }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
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
const db        = getFirestore(app);
const functions = getFunctions(app);

document.addEventListener('DOMContentLoaded', async () => {
  const $buyButtons      = document.querySelectorAll('[data-ak="buy-plan"]');
  const $downloadBtns    = document.querySelectorAll('[data-ak-download-guide]');
  const $downloadMapsBtns = document.querySelectorAll('[data-ak="download-google-maps-btn"]');
  const $prePurchaseEls  = document.querySelectorAll('[data-ak-pre-purchase]');
  const $postPurchaseEls = document.querySelectorAll('[data-ak-post-purchase]');


  // Show spinners immediately while auth + Firestore check runs
  showSpinners($buyButtons);

  // Fail-safe: remove spinners after 8s if auth or Firestore hasn't responded
  const spinnerTimeout = setTimeout(removeSpinners, 8000);

  try {
    const user = await new Promise(resolve => onAuthStateChanged(auth, resolve));

    if (!user) {
      clearTimeout(spinnerTimeout);
      removeSpinners();
      setUI(false);
      wireBuyButtonsLoggedOut($buyButtons);
      return;
    }

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

    clearTimeout(spinnerTimeout);
    removeSpinners();
    setUI(purchased);

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
      pollForPurchase(user, $buyButtons, $downloadBtns, $downloadMapsBtns, $postPurchaseEls);
      return;
    }

    if (!purchased) {
      wireBuyButtons(user, $buyButtons);
    } else {
      wireDownloadButton(user, $downloadBtns);
      wireGoogleMapsButton($downloadMapsBtns);
    }
  } catch (err) {
    clearTimeout(spinnerTimeout);
    removeSpinners();
    console.error('Purchase check failed:', err);
    // Can't confirm purchase status (Firestore unreachable/timed out) — degrade to the
    // not-purchased UI instead of leaving buy-plan/pre-purchase stuck hidden forever.
    setUI(false);
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

    $buyButtons.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (isLoading) return;
        isLoading = true;

        // Save each button's original content and replace with spinner
        const originals = Array.from($buyButtons).map(b => b.innerHTML);
        $buyButtons.forEach(b => {
          b.disabled = true;
          b.innerHTML = `
            <div style="display:inline-flex;align-items:center;justify-content:center;gap:8px;">
              <div style="width:14px;height:14px;border:2px solid rgba(255,255,255,0.4);border-top-color:currentColor;border-radius:50%;animation:ak-spin 0.7s linear infinite;flex-shrink:0;"></div>
              <span>Processing...</span>
            </div>`;
        });

        try {
          const createPlanCheckout = httpsCallable(functions, 'createPlanCheckout');
          const { data } = await createPlanCheckout({
            userEmail:  user.email,
            successUrl: (() => {
              const base = window.location.origin + window.location.pathname + '?purchase=success';
              if (window.location.pathname === '/itinerary-list') {
                const mail = localStorage['ak-userMail'];
                return base + (mail ? '&id=' + encodeURIComponent(mail) : '');
              }
              return base;
            })(),
            cancelUrl: (() => {
              const base = window.location.origin + window.location.pathname;
              if (window.location.pathname === '/itinerary-list') {
                const mail = localStorage['ak-userMail'];
                return base + (mail ? '?id=' + encodeURIComponent(mail) : '');
              }
              return base;
            })(),
          });
          window.location.href = data.url;
        } catch (err) {
          console.error('Checkout error:', err);
          isLoading = false;
          $buyButtons.forEach((b, i) => {
            b.disabled = false;
            b.innerHTML = originals[i];
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

  function wireDownloadButton(user, $downloadBtns) {
    if (!$downloadBtns.length) return;

    const $itineraryWrap = document.querySelector('[data-ak="itinerary-list"]');
    let isLoading = false;

    $downloadBtns.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (isLoading) return;
        isLoading = true;

        injectPdfSpinnerStyle();

        const originals = Array.from($downloadBtns).map(b => b.innerHTML);
        $downloadBtns.forEach(b => {
          b.disabled = true;
          b.innerHTML = `<span class="ak-pdf-btn-loading"><span class="ak-pdf-spinner"></span>Creating Guide...</span>`;
        });
        $itineraryWrap?.classList.add('disable');

        try {
          const generateGuide = httpsCallable(functions, 'generateAdvancedItineraryPdf', { timeout: 120000 });
          const { data } = await generateGuide({ userId: `user-${user.email}` });

          const bytes = Uint8Array.from(atob(data.pdf), c => c.charCodeAt(0));
          const blob  = new Blob([bytes], { type: 'application/pdf' });
          const url   = URL.createObjectURL(blob);
          const a     = document.createElement('a');
          a.href      = url;
          a.download  = data.filename || 'smart-guide.pdf';
          a.click();
          URL.revokeObjectURL(url);
        } catch (err) {
          console.error('Download error:', err);
        } finally {
          isLoading = false;
          $downloadBtns.forEach((b, i) => { b.disabled = false; b.innerHTML = originals[i]; });
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
      style.textContent = '@keyframes ak-spin { to { transform: rotate(360deg); } }';
      document.head.appendChild(style);
    }

    const onUpgradePage = window.location.pathname === '/upgrade';

    $postPurchaseEls.forEach(el => {
      if (onUpgradePage) {
        el.dataset.akOriginalHtml = el.innerHTML;
        el.disabled = true;
        el.innerHTML = `
          <div style="display:inline-flex;align-items:center;justify-content:center;gap:8px;">
            <div style="width:14px;height:14px;border:2px solid rgba(255,255,255,0.4);border-top-color:currentColor;border-radius:50%;animation:ak-spin 0.7s linear infinite;flex-shrink:0;"></div>
            <span>Processing...</span>
          </div>`;
      } else {
        const spinner = document.createElement('div');
        spinner.setAttribute('data-ak-spinner', '');
        spinner.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:10px;padding:16px 0;';
        spinner.innerHTML = `
          <div style="width:18px;height:18px;border:2px solid #e0e0e0;border-top-color:#555;border-radius:50%;animation:ak-spin 0.7s linear infinite;flex-shrink:0;"></div>
          <span style="font-size:14px;color:#888;">Processing...</span>
        `;
        el.parentNode.insertBefore(spinner, el);
      }
    });
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

  async function pollForPurchase(user, $buyButtons, $downloadBtns, $downloadMapsBtns, $postPurchaseEls, attempts = 0) {
    if (attempts >= 10) return;

    await new Promise(r => setTimeout(r, 1000));
    const userSnap  = await getDoc(doc(db, 'locationsData', `user-${user.email}`));
    const purchased = userSnap.exists() && userSnap.data().hasPurchasedPlan === true;

    if (purchased) {
      const userData = userSnap.data();
      const plan = userData.planDetails || {};
      if (plan.amountPaid)  localStorage.setItem('ak-sm-price', plan.amountPaid);
      if (plan.name)        localStorage.setItem('ak-sm-name',  plan.name);
      if (plan.description) localStorage.setItem('ak-sm-desc',  plan.description);

      fireConversionPixel(plan.amountPaid);
      setUI(true);
      wireDownloadButton(user, $downloadBtns);
      wireGoogleMapsButton($downloadMapsBtns);
      history.replaceState(null, '', window.location.pathname);
    } else {
      pollForPurchase(user, $buyButtons, $downloadBtns, $downloadMapsBtns, $postPurchaseEls, attempts + 1);
    }
  }
});
