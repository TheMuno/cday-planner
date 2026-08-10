/**
 * download-guide.js
 * Add as a <script type="module"> embed in Webflow (page settings → Before </body>).
 *
 * Webflow attributes managed by this script:
 *   data-ak="trip-heading"        — trip heading line, user's name gets filled in
 *   data-ak="trip-heading-date"   — travel date range, gets filled in
 *   data-ak="download-ez-guide"   — free itinerary PDF download button(s)
 *
 * data-ak-download-guide (Smart Guide) is NOT handled here — stripe-purchase.js runs
 * sitewide and already wires/reveals that button once purchase is confirmed. Wiring it
 * again here would double-fire the PDF generation on click.
 *
 * data-ak="download-google-maps-btn" is NOT handled here either — wired directly by
 * the KMLExport scripts.js embed (window.akWireGoogleMapsBtn), included on this page
 * alongside its kml-export/*.js helpers.
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
  measurementId: "G-Z7F4NJ4PHW"
};

const app       = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth      = getAuth(app);
const functions = getFunctions(app);

const $tripHeadingLine = document.querySelector('[data-ak="trip-heading"]');
const $tripDateLine    = document.querySelector('[data-ak="trip-heading-date"]');
const $ezGuideBtns     = document.querySelectorAll('[data-ak="download-ez-guide"]');

// Mirrors get-guide.js / verify-itinerary.js / build-itinerary.js's restoreTripHeading().
function restoreTripHeading() {
  if (auth.currentUser) {
    const $headingH2 = document.querySelector('[data-ak="trip-heading"] h2');
    if ($headingH2) {
      let tripName = localStorage['ak-user-name'] || auth.currentUser.displayName?.split(/\s+/)[0] || auth.currentUser.email?.split('@')[0] || '';
      if (tripName) {
        tripName = tripName.charAt(0).toUpperCase() + tripName.slice(1).toLowerCase();
        $headingH2.textContent = `${tripName}'s Trip to N.Y.C`;
      }
    }
  }

  if (!$tripDateLine || !localStorage['ak-travel-days']) return;

  let flatpickrDate;
  try {
    ({ flatpickrDate } = JSON.parse(localStorage['ak-travel-days']));
  } catch (e) {
    return;
  }
  if (!flatpickrDate) return;

  const [startRaw, endRaw] = flatpickrDate.split(/\s+to\s+/);
  const monthArr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmt = d => `${monthArr[d.getMonth()]} ${d.getDate()}`;

  const $children = $tripDateLine.children;
  if ($children.length < 2) return;

  const $firstEm = $children[0].querySelector('p em');
  const $lastEm = $children[$children.length - 1].querySelector('p em');
  if ($firstEm) $firstEm.textContent = fmt(new Date(startRaw));
  if ($lastEm) $lastEm.textContent = fmt(new Date(endRaw || startRaw));
}

// Mirrors get-guide.js / verify-itinerary.js / calculate-pass-savings.js's redirectToStep1().
function redirectToStep1(message) {
  showRedirectLoader(message);
  setTimeout(() => { window.location.href = '/smart-guide/itinerary'; }, 1500);
}

function showRedirectLoader(message) {
  if (!document.getElementById('gg-spinner-style')) {
    const style = document.createElement('style');
    style.id = 'gg-spinner-style';
    style.textContent = "@keyframes gg-spin { to { transform: rotate(360deg); } }";
    document.head.appendChild(style);
  }
  const overlay = document.createElement('div');
  overlay.id = 'gg-loader-overlay';
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0',
    background: 'rgba(255,255,255,0.5)',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    gap: '12px', zIndex: '9999',
  });
  const redirecting = document.createElement('p');
  redirecting.textContent = 'Redirecting...';
  Object.assign(redirecting.style, { margin: '0', fontSize: '14px', color: '#111' });
  overlay.appendChild(redirecting);
  const label = document.createElement('p');
  label.textContent = message;
  Object.assign(label.style, { margin: '0', fontSize: '14px', color: '#111' });
  overlay.appendChild(label);
  const spinner = document.createElement('div');
  Object.assign(spinner.style, {
    width: '40px', height: '40px',
    border: '4px solid #e5e7eb', borderTopColor: '#111',
    borderRadius: '50%', animation: 'gg-spin 0.7s linear infinite',
  });
  overlay.appendChild(spinner);
  document.body.appendChild(overlay);
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

// --- Free itinerary PDF (no purchase required) ---
function wireEzGuideButton(user) {
  if (!$ezGuideBtns.length) return;
  let isLoading = false;

  $ezGuideBtns.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (isLoading) return;
      isLoading = true;

      injectPdfSpinnerStyle();

      // Only the clicked button shows the spinner/text; the rest are just
      // disabled so a second PDF generation can't be started mid-flight.
      const originals = Array.from($ezGuideBtns).map(b => b.innerHTML);
      $ezGuideBtns.forEach(b => {
        b.disabled = true;
        b.style.opacity = '0.8';
      });
      btn.style.minWidth = `${btn.getBoundingClientRect().width}px`;
      btn.innerHTML = `<span class="ak-pdf-btn-loading"><span class="ak-pdf-spinner"></span>Creating Guide...</span>`;

      try {
        const generateItineraryPdf = httpsCallable(functions, 'generateItineraryPdf');
        const { data } = await generateItineraryPdf({ userId: `user-${user.email}` });

        const bytes = Uint8Array.from(atob(data.pdf), c => c.charCodeAt(0));
        const blob  = new Blob([bytes], { type: 'application/pdf' });
        const url   = URL.createObjectURL(blob);
        const a     = document.createElement('a');
        a.href      = url;
        a.download  = data.filename;
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error('EZ guide download failed:', err);
        alert('Failed to generate PDF. Please try again.');
      } finally {
        isLoading = false;
        $ezGuideBtns.forEach((b, i) => {
          b.innerHTML = originals[i];
          b.disabled = false;
          b.style.opacity = '';
          b.style.minWidth = '';
        });
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const user = await new Promise(resolve => onAuthStateChanged(auth, resolve));
  if (!user) {
    redirectToStep1('User not logged in');
    return;
  }

  localStorage['ak-userMail'] = user.email;
  restoreTripHeading();
  $tripHeadingLine?.removeAttribute('data-ak-skeleton-pulse');
  $tripDateLine?.removeAttribute('data-ak-skeleton-pulse');

  wireEzGuideButton(user);
});
