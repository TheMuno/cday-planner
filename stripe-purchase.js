/**
 * stripe-purchase.js
 * Add as a <script type="module"> embed in Webflow (page settings → Before </body>).
 *
 * Webflow attributes managed by this script:
 *   data-ak="buy-plan"       — checkout trigger buttons (hidden via data-ak-hidden when user has paid)
 *   data-ak-download-guide   — download button (hidden via data-ak-hidden until user has paid)
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

const $buyButtons  = document.querySelectorAll('[data-ak="buy-plan"]');
const $downloadBtn = document.querySelector('[data-ak-download-guide]');

window.addEventListener('load', async () => {
  const user = await new Promise(resolve => onAuthStateChanged(auth, resolve));

  if (!user) return;

  const userRef   = doc(db, 'locationsData', `user-${user.email}`);
  const userSnap  = await getDoc(userRef);
  const purchased = userSnap.exists() && userSnap.data().hasPurchasedPlan === true;

  setUI(purchased);

  if (!purchased && new URLSearchParams(window.location.search).get('purchase') === 'success') {
    pollForPurchase(user);
    return;
  }

  if (!purchased) {
    wireBuyButtons(user);
  } else {
    wireDownloadButton(user);
  }
});

function setUI(purchased) {
  $buyButtons.forEach(btn => {
    if (purchased) btn.setAttribute('data-ak-hidden', '');
    else btn.removeAttribute('data-ak-hidden');
  });

  if ($downloadBtn) {
    if (purchased) $downloadBtn.removeAttribute('data-ak-hidden');
    else $downloadBtn.setAttribute('data-ak-hidden', '');
  }
}

function wireBuyButtons(user) {
  $buyButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      $buyButtons.forEach(b => { b.disabled = true; b.style.opacity = '0.6'; });

      try {
        const createPlanCheckout = httpsCallable(functions, 'createPlanCheckout');
        const { data } = await createPlanCheckout({
          userEmail:  user.email,
          successUrl: window.location.origin + window.location.pathname + '?purchase=success',
          cancelUrl:  window.location.origin + window.location.pathname,
        });
        window.location.href = data.url;
      } catch (err) {
        console.error('Checkout error:', err);
        $buyButtons.forEach(b => { b.disabled = false; b.style.opacity = ''; });
      }
    });
  });
}

function wireDownloadButton(user) {
  if (!$downloadBtn) return;

  $downloadBtn.addEventListener('click', async () => {
    $downloadBtn.disabled = true;
    $downloadBtn.style.opacity = '0.6';

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
      $downloadBtn.disabled = false;
      $downloadBtn.style.opacity = '';
    }
  });
}

async function pollForPurchase(user, attempts = 0) {
  if (attempts >= 10) return;

  await new Promise(r => setTimeout(r, 1000));
  const userSnap  = await getDoc(doc(db, 'locationsData', `user-${user.email}`));
  const purchased = userSnap.exists() && userSnap.data().hasPurchasedPlan === true;

  if (purchased) {
    setUI(true);
    wireDownloadButton(user);
    history.replaceState(null, '', window.location.pathname);
  } else {
    pollForPurchase(user, attempts + 1);
  }
}
