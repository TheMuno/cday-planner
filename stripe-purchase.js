/**
 * stripe-purchase.js
 * Add as a <script type="module"> embed in Webflow (page settings → Before </body>).
 *
 * Webflow attributes managed by this script:
 *   data-ak="buy-plan"       — checkout trigger buttons (hidden after purchase)
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
  const $postPurchaseEls = document.querySelectorAll('[data-ak-post-purchase]');


  // Show spinners immediately while auth + Firestore check runs
  showSpinners($buyButtons);

  const user = await new Promise(resolve => onAuthStateChanged(auth, resolve));

  if (!user) { removeSpinners(); return; }

  const userRef   = doc(db, 'locationsData', `user-${user.email}`);
  const userSnap  = await getDoc(userRef);
  const purchased = userSnap.exists() && userSnap.data().hasPurchasedPlan === true;

  removeSpinners();
  setUI(purchased);

  if (!purchased && new URLSearchParams(window.location.search).get('purchase') === 'success') {
    pollForPurchase(user, $buyButtons, $downloadBtns, $postPurchaseEls);
    return;
  }

  if (!purchased) {
    wireBuyButtons(user, $buyButtons);
  } else {
    wireDownloadButton(user, $downloadBtns);
  }

  function setUI(purchased) {
    $buyButtons.forEach(btn => {
      if (purchased) btn.setAttribute('data-ak-hidden', '');
      else btn.removeAttribute('data-ak-hidden');
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
  }

  function wireBuyButtons(user, $buyButtons) {
    $buyButtons.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();

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
            successUrl: window.location.origin + '/thank-you',
            cancelUrl:  window.location.origin + window.location.pathname,
          });
          window.location.href = data.url;
        } catch (err) {
          console.error('Checkout error:', err);
          $buyButtons.forEach((b, i) => {
            b.disabled = false;
            b.innerHTML = originals[i];
          });
        }
      });
    });
  }

  function wireDownloadButton(user, $downloadBtns) {
    if (!$downloadBtns.length) return;

    $downloadBtns.forEach(btn => {
      btn.addEventListener('click', async () => {
        $downloadBtns.forEach(b => { b.disabled = true; b.style.opacity = '0.6'; });

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
          $downloadBtns.forEach(b => { b.disabled = false; b.style.opacity = ''; });
        }
      });
    });
  }

  function showSpinners($postPurchaseEls) {
    if (!$postPurchaseEls.length) return;
    // Add keyframe once to the document
    if (!document.querySelector('#ak-spinner-style')) {
      const style = document.createElement('style');
      style.id = 'ak-spinner-style';
      style.textContent = '@keyframes ak-spin { to { transform: rotate(360deg); } }';
      document.head.appendChild(style);
    }
    $postPurchaseEls.forEach(el => {
      const spinner = document.createElement('div');
      spinner.setAttribute('data-ak-spinner', '');
      spinner.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:10px;padding:16px 0;';
      spinner.innerHTML = `
        <div style="width:18px;height:18px;border:2px solid #e0e0e0;border-top-color:#555;border-radius:50%;animation:ak-spin 0.7s linear infinite;flex-shrink:0;"></div>
        <span style="font-size:14px;color:#888;">Processing...</span>
      `;
      el.parentNode.insertBefore(spinner, el);
    });
  }

  function removeSpinners() {
    document.querySelectorAll('[data-ak-spinner]').forEach(el => el.remove());
  }

  async function pollForPurchase(user, $buyButtons, $downloadBtns, $postPurchaseEls, attempts = 0) {
    if (attempts >= 10) return;

    await new Promise(r => setTimeout(r, 1000));
    const userSnap  = await getDoc(doc(db, 'locationsData', `user-${user.email}`));
    const purchased = userSnap.exists() && userSnap.data().hasPurchasedPlan === true;

    if (purchased) {
      setUI(true);
      wireDownloadButton(user, $downloadBtns);
      history.replaceState(null, '', window.location.pathname);
    } else {
      pollForPurchase(user, $buyButtons, $downloadBtns, $postPurchaseEls, attempts + 1);
    }
  }
});
