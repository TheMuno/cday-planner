import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, initializeFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// --- Firebase config ---
const firebaseConfig = {
  apiKey: "AIzaSyBQPqbtlfHPLpB-JYbyxDZiugu4NqwpSeM",
  authDomain: "askkhonsu-map.firebaseapp.com",
  projectId: "askkhonsu-map",
  storageBucket: "askkhonsu-map.appspot.com",
  messagingSenderId: "266031876218",
  appId: "1:266031876218:web:ec93411f1c13d9731e93c3",
  measurementId: "G-Z7F4NJ4PHW"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const functions = getFunctions(app);
const auth = getAuth(app);

// Long-polling avoids ad blockers / proxies that kill the default WebChannel streaming
// connection, which is what causes "Could not reach Cloud Firestore backend" timeouts.
let db;
try {
  db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
} catch (e) {
  db = getFirestore(app); // Firestore already initialized for this app elsewhere on the page
}

const $downloadBtns = document.querySelectorAll('[data-ak="download-ez-guide"]');
const $tripHeadingLine = document.querySelector('[data-ak="trip-heading"]');
const $tripDateLine = document.querySelector('[data-ak="trip-heading-date"]');

// Captured once, before populateVerifyContent() ever mutates the DOM — now that it can run
// twice (immediately, then again after syncWithDB()), re-querying '.verify_block_wrap' live
// would grab an already-populated (and possibly section-hidden) day block as the template for
// the second pass instead of the pristine sample markup.
const $verifyContainer = document.querySelector('.verify_content');
const $verifyDayTemplate = $verifyContainer?.querySelector('.verify_block_wrap')?.cloneNode(true) || null;

// Mirrors calculate-pass-savings.js / build-itinerary.js's restoreTripHeading(), split into two
// halves so the date line (no auth dependency) can be restored immediately on DOMContentLoaded
// instead of waiting on the Firebase auth round-trip.
function restoreTripHeadingName() {
  if (!auth.currentUser) return;
  const $headingH2 = document.querySelector('[data-ak="trip-heading"] h2');
  if (!$headingH2) return;
  let tripName = localStorage['ak-user-name'] || auth.currentUser.displayName?.split(/\s+/)[0] || auth.currentUser.email?.split('@')[0] || '';
  if (tripName) {
    tripName = tripName.charAt(0).toUpperCase() + tripName.slice(1).toLowerCase();
    $headingH2.textContent = `${tripName}'s Trip to N.Y.C`;
  }
}

function restoreTripDateLine() {
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

// Derives a sibling page URL from this page's own URL instead of hardcoding the folder prefix —
// e.g. on "/xyz/verify-itinerary" this resolves 'itinerary' to "/xyz/itinerary", so it keeps
// working no matter what that prefix is or if it ever changes.
function siblingPagePath(targetSlug) {
  const segments = window.location.pathname.split('/').filter(Boolean);
  segments[segments.length - 1] = targetSlug;
  return '/' + segments.join('/');
}

// Mirrors calculate-pass-savings.js's redirectToStep1().
function redirectToStep1(message) {
  showRedirectLoader(message);
  setTimeout(() => { window.location.href = siblingPagePath('itinerary'); }, 1500);
}

// Mirrors calculate-pass-savings.js's showRedirectLoader().
function showRedirectLoader(message) {
  if (!document.getElementById('vi-spinner-style')) {
    const style = document.createElement('style');
    style.id = 'vi-spinner-style';
    style.textContent = "@keyframes vi-spin { to { transform: rotate(360deg); } }";
    document.head.appendChild(style);
  }
  const overlay = document.createElement('div');
  overlay.id = 'vi-loader-overlay';
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
    borderRadius: '50%', animation: 'vi-spin 0.7s linear infinite',
  });
  overlay.appendChild(spinner);
  document.body.appendChild(overlay);
}

// Restores whatever this user last saved to Firestore into localStorage, before populateVerifyContent()
// reads those same keys — mirrors build-itinerary.js's retrieveDBData()/syncWithDB(). Unlike that page,
// nothing gets edited here, so there's no local-vs-DB precedence to resolve: a value already in
// localStorage (e.g. carried over from build-itinerary.js earlier in this session) is just as fresh as
// the DB copy, so it's kept as-is and DB only fills in whatever's missing locally.
async function retrieveDBData(userMail) {
  const userRef = doc(db, 'locationsData', `user-${userMail}`);
  const docSnap = await getDoc(userRef);
  return docSnap.exists() ? docSnap.data() : null;
}

async function syncWithDB() {
  const userMail = localStorage['ak-referrer-mail'] || localStorage['ak-userMail'];
  if (!userMail) return;

  const dbData = await retrieveDBData(userMail);
  if (!dbData) return;

  if (!localStorage['ak-travel-days'] && dbData.travelDates) localStorage['ak-travel-days'] = dbData.travelDates;
  if (!localStorage['ak-user-name'] && dbData.tripName) localStorage['ak-user-name'] = dbData.tripName;
  if (!localStorage['ak-attractions-saved'] && dbData.savedAttractions) localStorage['ak-attractions-saved'] = dbData.savedAttractions;
}

// --- Verify-content day/attraction/restaurant tables ---
// Mirrors build-itinerary.js's restoreTripDaySlides() for the date math, and the PDF backend's
// pdfRenderDay() (functions/index.js) for the day-label format and "skip section if empty" rule,
// so what the user verifies here matches what the ez-guide PDF actually renders.
function getTravelDayDates() {
  if (!localStorage['ak-travel-days']) return [];

  let flatpickrDate;
  try {
    ({ flatpickrDate } = JSON.parse(localStorage['ak-travel-days']));
  } catch (e) {
    return [];
  }
  if (!flatpickrDate) return [];

  const [startRaw, endRaw] = flatpickrDate.split(/\s+to\s+/);
  const startDate = new Date(startRaw);
  const endDate = new Date(endRaw || startRaw);
  if (isNaN(startDate) || isNaN(endDate)) return [];

  const msPerDay = 24 * 60 * 60 * 1000;
  const totalDays = Math.round((endDate.getTime() - startDate.getTime()) / msPerDay) + 1;
  if (totalDays < 1) return [];

  const days = [];
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

function getSavedAttractions() {
  try {
    return JSON.parse(localStorage['ak-attractions-saved'] || '{}');
  } catch (e) {
    return {};
  }
}

// Replaces the sample rows in a verify_table_wrap (keeping its header row) with one cloned row
// per item.
function populateVerifyTable($tableWrap, items) {
  const $rows = $tableWrap.querySelectorAll('.verify_table_row');
  const $rowTemplate = $rows[1];
  if (!$rowTemplate) return;

  for (let i = $rows.length - 1; i >= 1; i--) $rows[i].remove();

  items.forEach(item => {
    const $row = $rowTemplate.cloneNode(true);
    const $nameEl = $row.querySelector('.verify_table_main p');
    const [$neighborhoodEl, $addressEl] = $row.querySelectorAll('.verify_table_column p');
    if ($nameEl) $nameEl.textContent = item.displayName || '';
    if ($neighborhoodEl) $neighborhoodEl.textContent = item.neighborhood || '';
    if ($addressEl) $addressEl.textContent = item.address || '';
    $tableWrap.appendChild($row);
  });
}

function populateVerifyContent() {
  if (!$verifyContainer || !$verifyDayTemplate) return;

  const $template = $verifyDayTemplate.cloneNode(true);
  const days = getTravelDayDates();
  const savedAttractions = getSavedAttractions();

  $verifyContainer.querySelectorAll('.verify_block_wrap').forEach($el => $el.remove());

  days.forEach((date, i) => {
    const slide = savedAttractions[`slide${i + 1}`] || {};
    const attractions = slide.attractions || [];
    const restaurants = slide.restaurants || [];
    const totalCount = attractions.length + restaurants.length;
    if (!totalCount) return;

    const $day = $template.cloneNode(true);

    const $heading = $day.querySelector('.verify_block_top h1');
    if ($heading) $heading.textContent = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    const $countEl = $day.querySelector('.verify_block_top p');
    if ($countEl) $countEl.textContent = `${totalCount} ${totalCount === 1 ? 'Activity' : 'Activities'}`;

    $day.querySelectorAll('.verify_block_bit').forEach($bit => {
      const label = $bit.querySelector('.verify_block_tag p')?.textContent?.trim().toLowerCase();
      const items = label === 'attractions' ? attractions : label === 'restaurants' ? restaurants : null;
      const $tableWrap = $bit.querySelector('.verify_table_wrap');

      if (!items || !items.length || !$tableWrap) {
        $bit.style.display = 'none';
        return;
      }
      populateVerifyTable($tableWrap, items);
    });

    $verifyContainer.appendChild($day);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  // Neither depends on auth — both read only localStorage, which is already populated in the
  // common case (syncWithDB() below only backfills it when missing) — so show them immediately
  // instead of leaving the skeleton up through the auth round-trip and the Firestore sync.
  restoreTripDateLine();
  populateVerifyContent();
  $tripDateLine?.removeAttribute('data-ak-skeleton-pulse');

  const user = await new Promise(resolve => onAuthStateChanged(auth, resolve));
  if (!user) {
    redirectToStep1('User not logged in');
    return;
  }

  // Bridge: keep ak-userMail consistent so the rest of the code works unchanged (mirrors customize-itinerary.js).
  localStorage['ak-userMail'] = user.email;
  restoreTripHeadingName();
  $tripHeadingLine?.removeAttribute('data-ak-skeleton-pulse');

  await syncWithDB();
  // Re-run in case travelDates/tripName/savedAttractions only existed in the DB.
  restoreTripHeadingName();
  restoreTripDateLine();
  populateVerifyContent();
});

// --- Download as PDF ---
function injectPdfSpinnerStyle() {
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

document.querySelector('[data-ak="continue-to-smart-guide"]')?.addEventListener('click', e => {
  e.preventDefault();
  const isDemoHotel = window.location.href.includes('demo-hotel');
  window.location.href = isDemoHotel ? '/demo-hotel/download-your-smart-guide' : siblingPagePath('get-the-guide');
});

if ($downloadBtns.length) {
  let isLoading = false;

  $downloadBtns.forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      if (isLoading) return;
      const userMail = localStorage['ak-userMail'];
      if (!userMail) return;

      isLoading = true;
      injectPdfSpinnerStyle();

      const originals = Array.from($downloadBtns).map(b => b.innerHTML);
      $downloadBtns.forEach(b => {
        b.style.minWidth = `${b.getBoundingClientRect().width}px`;
        b.innerHTML = `<span class="ak-pdf-btn-loading"><span class="ak-pdf-spinner"></span>Creating Guide...</span>`;
        b.disabled = true;
        b.style.opacity = '0.8';
      });

      try {
        const generateItineraryPdf = httpsCallable(functions, "generateItineraryPdf");
        const { data } = await generateItineraryPdf({ userId: `user-${userMail}` });

        const bytes = Uint8Array.from(atob(data.pdf), c => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = data.filename;
        a.click();

        URL.revokeObjectURL(url);
      } catch (err) {
        console.error("❌ PDF generation failed:", err);
        alert("Failed to generate PDF. Please try again.");
      } finally {
        isLoading = false;
        $downloadBtns.forEach((b, i) => {
          b.innerHTML = originals[i];
          b.disabled = false;
          b.style.opacity = '';
          b.style.minWidth = '';
        });
      }
    });
  });
}
