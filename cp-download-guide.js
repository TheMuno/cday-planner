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

// Firebase is loaded with dynamic import() rather than static `import ... from` lines. Static
// imports block evaluation of this entire module until firebase-app/auth/functions have all
// downloaded — and the trip heading was also held behind DOMContentLoaded, which waits on every
// module/deferred script on the page. That's what made the trip info slow to appear. Kicking the
// downloads off here (not awaited) lets the trip heading below render right away from
// localStorage, while Firebase loads in the background for the parts that need it.
const firebaseConfig = {
  apiKey: "AIzaSyBQPqbtlfHPLpB-JYbyxDZiugu4NqwpSeM",
  authDomain: "askkhonsu-map.firebaseapp.com",
  projectId: "askkhonsu-map",
  storageBucket: "askkhonsu-map.appspot.com",
  messagingSenderId: "266031876218",
  appId: "1:266031876218:web:ec93411f1c13d9731e93c3",
  measurementId: "G-Z7F4NJ4PHW"
};

const firebaseReady = Promise.all([
  import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js"),
  import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js"),
  import("https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js"),
]).then(([appMod, authMod, functionsMod]) => {
  const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(firebaseConfig);
  return {
    auth: authMod.getAuth(app),
    onAuthStateChanged: authMod.onAuthStateChanged,
    functions: functionsMod.getFunctions(app),
    httpsCallable: functionsMod.httpsCallable,
  };
});

const $tripHeadingLine = document.querySelector('[data-ak="trip-heading"]');
const $tripDateLine    = document.querySelector('[data-ak="trip-heading-date"]');
const $ezGuideBtns     = document.querySelectorAll('[data-ak="download-ez-guide"]');

// Captured once, before restoreTripHeadingName() ever mutates it — the Webflow markup's own
// h2 text (e.g. "My Trip to N.Y.C") is the template; only its first word gets swapped, so the
// rest of the sentence is whatever's authored in Webflow instead of a hardcoded destination.
const $headingH2 = $tripHeadingLine?.querySelector('h2') || null;
const headingTemplateText = $headingH2?.textContent ?? '';

// Mirrors build-itinerary.js's restoreTripHeadingName()/restoreTripDateLine(). Both return true
// only if they actually filled in a value. Takes `user` as a param so the localStorage case below
// doesn't need Firebase at all — only the displayName/email fallback does, via finishTripHeading().
function restoreTripHeadingName(user) {
  if (!$headingH2 || !headingTemplateText) return false;
  let tripName = localStorage['ak-user-name'] || user?.displayName?.split(/\s+/)[0] || user?.email?.split('@')[0] || '';
  if (!tripName) return false;
  tripName = tripName.charAt(0).toUpperCase() + tripName.slice(1).toLowerCase();
  $headingH2.textContent = headingTemplateText.replace(/^\S+/, `${tripName}'s`);
  return true;
}

function restoreTripDateLine() {
  if (!$tripDateLine || !localStorage['ak-travel-days']) return false;

  let flatpickrDate;
  try {
    ({ flatpickrDate } = JSON.parse(localStorage['ak-travel-days']));
  } catch (e) {
    return false;
  }
  if (!flatpickrDate) return false;

  const [startRaw, endRaw] = flatpickrDate.split(/\s+to\s+/);
  const monthArr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmt = d => `${monthArr[d.getMonth()]} ${d.getDate()}`;

  const $children = $tripDateLine.children;
  if ($children.length < 2) return false;

  const $firstEm = $children[0].querySelector('p em');
  const $lastEm = $children[$children.length - 1].querySelector('p em');
  if ($firstEm) $firstEm.textContent = fmt(new Date(startRaw));
  if ($lastEm) $lastEm.textContent = fmt(new Date(endRaw || startRaw));
  return true;
}

// First attempt, straight from localStorage. As a module script this already runs after the HTML
// is parsed, so both elements exist here. Each skeleton only comes down if its value was actually
// found — otherwise it stays up (rather than flashing Webflow's placeholder text) until
// finishTripHeading() retries once auth is known.
if (restoreTripDateLine()) $tripDateLine?.removeAttribute('data-ak-skeleton-pulse');
if (restoreTripHeadingName()) $tripHeadingLine?.removeAttribute('data-ak-skeleton-pulse');

// Second (and last) attempt, after auth: fills in anything that only exists on the signed-in
// account, then drops both skeletons regardless — if there's still no value by now there never
// will be on this load, so Webflow's placeholder text is the right thing to show.
function finishTripHeading(user) {
  restoreTripHeadingName(user);
  restoreTripDateLine();
  $tripHeadingLine?.removeAttribute('data-ak-skeleton-pulse');
  $tripDateLine?.removeAttribute('data-ak-skeleton-pulse');
}

// Derives a sibling page URL from this page's own URL instead of hardcoding the folder prefix —
// e.g. on "/xyz/download-guide" this resolves 'itinerary' to "/xyz/itinerary", so it keeps
// working no matter what that prefix is or if it ever changes.
function siblingPagePath(targetSlug) {
  const segments = window.location.pathname.split('/').filter(Boolean);
  segments[segments.length - 1] = targetSlug;
  return '/' + segments.join('/');
}

// Mirrors get-guide.js / verify-itinerary.js / calculate-pass-savings.js's redirectToStep1().
function redirectToStep1(message) {
  showRedirectLoader(message);
  setTimeout(() => { window.location.href = siblingPagePath('itinerary'); }, 1500);
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
        const { functions, httpsCallable } = await firebaseReady;
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

// --- Auto-email the pre-arrival report PDF on landing ---
// No client-side "only once per session" gate here on purpose: the correctness guard lives
// entirely server-side in generateReportPdf (reportEmailedAt vs. the itinerary's ModifiedAt),
// so an edit-then-revisit within the same tab/session still gets a fresh email. That guard
// also short-circuits before the expensive PDF render whenever nothing changed, so calling
// this on every landing is cheap -- just a Firestore read and an early return in that case.
function emailReportOnLanding(user) {
  const fire = async () => {
    const { functions, httpsCallable } = await firebaseReady;
    const generateReportPdf = httpsCallable(functions, 'generateReportPdf', { timeout: 60000 });
    generateReportPdf({ userId: `user-${user.email}`, sendEmail: true })
      .catch(err => console.error('Failed to email report on landing:', err));
  };

  // Deferred to an idle moment (falling back to a short delay) instead of firing immediately on
  // landing, so this background request doesn't compete with the page's own
  // images/maps/fonts for bandwidth while they're still loading.
  if ('requestIdleCallback' in window) {
    requestIdleCallback(fire, { timeout: 5000 });
  } else {
    setTimeout(fire, 2000);
  }
}

// --- Auto-email the Smart Guide PDF on landing ---
// Fires once per browser session (not on every reload/navigation back to this page) so
// simply landing here doesn't repeatedly re-trigger the expensive (~1GiB/120s) PDF
// render + email on the backend. This calls the same generateAdvancedItineraryPdf
// Cloud Function the Smart Guide download button uses (stripe-purchase.js) — passing
// sendEmail:true is what tells it to also email the PDF, instead of just returning it
// for a browser download. It intentionally ignores the returned PDF data here; nothing
// is downloaded client-side, the email is the whole point of this call.
function emailSmartGuideOnLanding(user) {
  const flagKey = `ak-guide-emailed-${user.email}`;
  if (sessionStorage.getItem(flagKey)) return;
  sessionStorage.setItem(flagKey, '1');

  const fire = async () => {
    const { functions, httpsCallable } = await firebaseReady;
    const generateAdvancedItineraryPdf = httpsCallable(functions, 'generateAdvancedItineraryPdf', { timeout: 120000 });
    // `hotel: 'carlton-arms'` skips its hasPurchasedPlan check (FREE_GUIDE_HOTELS in
    // functions/index.js) — this file only runs on Carlton Arms pages, whose Smart Guide is free.
    generateAdvancedItineraryPdf({ userId: `user-${user.email}`, sendEmail: true, hotel: 'carlton-arms' })
      .catch(err => console.error('Failed to email Smart Guide on landing:', err));
  };

  // Deferred to an idle moment (falling back to a short delay) instead of firing
  // immediately on DOMContentLoaded, so this long-lived background request doesn't
  // compete with the page's own images/maps/fonts for bandwidth while they're still
  // loading -- that contention was making the page feel slower to land on.
  if ('requestIdleCallback' in window) {
    requestIdleCallback(fire, { timeout: 5000 });
  } else {
    setTimeout(fire, 2000);
  }
}

// --- Cross-button click lock: Smart Guide download + Google Maps export share this ---
// [data-ak-download-guide="true"] buttons (stripe-purchase.js) and the
// [data-ak="download-google-maps-btn"] button (KMLExport/scripts.js) each already
// disable buttons *within* their own group during their async flow, and flip
// `.disabled` back to false via a `finally` block when done. This just extends that
// lock across both groups on click — using the clicked button's own `disabled`
// attribute as the signal that its owning script's flow has finished, so this file
// never has to touch that flow itself.
function wireDownloadButtonLock() {
  const selector = '[data-ak-download-guide="true"], [data-ak="download-google-maps-btn"]';

  document.addEventListener('click', e => {
    const $clicked = e.target.closest(selector);
    if (!$clicked || $clicked.disabled) return;

    const $others = Array.from(document.querySelectorAll(selector)).filter(b => b !== $clicked);
    if (!$others.length) return;

    $others.forEach(b => {
      b.disabled = true;
      b.style.opacity = '0.9';
    });
    $clicked.disabled = true;

    const observer = new MutationObserver(() => {
      if ($clicked.disabled) return;
      $others.forEach(b => {
        b.disabled = false;
        b.style.opacity = '';
      });
      observer.disconnect();
    });
    observer.observe($clicked, { attributes: true, attributeFilter: ['disabled'] });
  }, true);
}
wireDownloadButtonLock();

// No DOMContentLoaded wrapper needed: a module script runs after the HTML is parsed, and waiting
// on that event would also wait on every other module/deferred script on the page.
(async () => {
  const { auth, onAuthStateChanged } = await firebaseReady;
  const user = await new Promise(resolve => onAuthStateChanged(auth, resolve));
  if (!user) {
    redirectToStep1('User not logged in');
    return;
  }

  localStorage['ak-userMail'] = user.email;
  finishTripHeading(user);

  wireEzGuideButton(user);
  // Report PDF auto-email turned off for now -- only the Smart Guide email (below) goes out.
  // emailReportOnLanding(user);
  emailSmartGuideOnLanding(user);
})();
