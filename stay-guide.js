/**
 * stay-guide.js -- /stay/download-your-smart-guide (step 3).
 * Add as a <script type="module"> embed in Webflow (page settings → Before </body>).
 *
 * Handled here:
 *   data-ak="nav-logo"            — swapped for the guest's hotel logo (same as stay-verify.js)
 *   data-ak="trip-heading"        — trip heading line, guest's name (and city) filled in
 *   data-ak="trip-heading-date"   — travel date range, filled in
 *   The Smart Guide is also emailed to the guest once on landing (same as the hotel download-guide pages).
 *
 * NOT handled here (wiring them again would double-fire on click):
 *   data-ak-download-guide / data-ak="download-flagship-smart-guide" — stripe-purchase.js reveals and
 *     wires these; on /stay/ pages it sends the guest's hotel (ak-stay-hotel) so the guide is free.
 *   data-ak="download-google-maps-btn" — wired by the KMLExport scripts.js embed
 *     (window.akWireGoogleMapsBtn) through stripe-purchase.js; that embed and its kml-export/*.js
 *     helpers, JSZip and alertify (its toasts) must be on this page.
 * Both read the trip from Firestore/localStorage, which syncWithDB() below fills in when missing.
 */

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

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
const auth = getAuth(app);

// firebase-firestore.js / firebase-functions.js are only needed after sign-in, so they're loaded
// lazily (same as stay-verify.js) instead of blocking this whole module from running.
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

let functionsPromise = null;
function getFunctionsMod() {
  if (!functionsPromise) {
    functionsPromise = import("https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js")
      .then(mod => ({ functions: mod.getFunctions(app), httpsCallable: mod.httpsCallable }));
  }
  return functionsPromise;
}

// Same fixed hotels as stay-itinerary.js, only what the heading's city and the nav logo need.
const FIXED_HOTELS = {
  'carlton-arms': { name: 'Carlton Arms Hotel', center: { lat: 40.7401607, lng: -73.9852042 }, logo: 'https://cdn.prod.website-files.com/671ae7755af1656d8b2ea93c/6a85ac90d9eca4697038d8f9_carlton-arms-hotel-logo1.png' },
  'compton': { name: 'The Compton Bentonville', city: 'Bentonville', center: { lat: 36.3720385, lng: -94.2075697 } },
};
// firebase-auth.js clears ak-flow-trial-hotel/ak-hotel-referral on sign-in, so the hotel is kept in
// ak-stay-hotel (set by the look-up form and stay-itinerary.js), and saved with the trip as stayHotel
// for other devices -- see syncWithDB(). The old keys still count for anyone who picked a hotel before.
const fixedHotelKey = localStorage['ak-stay-hotel'] || localStorage['ak-flow-trial-hotel'] || localStorage['ak-hotel-referral'];
if (fixedHotelKey && !localStorage['ak-stay-hotel']) localStorage['ak-stay-hotel'] = fixedHotelKey;
let fixedHotel = FIXED_HOTELS[fixedHotelKey] || null;

// The `hotel` sent to the PDF Cloud Function, which skips its purchase check for these (FREE_GUIDE_HOTELS
// in functions/index.js). Same mapping as stripe-purchase.js's getStayHotel(): 'demo' and anything
// unknown go to the demo hotel.
const FREE_GUIDE_HOTELS = ['carlton-arms', 'compton', 'demo-hotel'];
function getGuideHotel() {
  const key = localStorage['ak-stay-hotel'] || '';
  return FREE_GUIDE_HOTELS.includes(key) ? key : 'demo-hotel';
}

// The nav logo (data-ak="nav-logo", Webflow's inline Khonsu SVG): a fixed hotel with its own logo
// swaps the SVG for an <img> of it; every other hotel keeps the SVG. loader.css keeps the logo
// hidden until data-ak-logo-ready is set here, so the Khonsu logo never flashes up first. If the
// hotel's logo fails to load, the SVG is shown instead. (Mirrors stay-itinerary.js.)
const $navLogo = document.querySelector('[data-ak="nav-logo"]');
function revealNavLogo() {
  $navLogo?.setAttribute('data-ak-logo-ready', 'true');
}
function showHotelLogo() {
  const hotel = fixedHotel;
  if (!$navLogo || !hotel?.logo) return revealNavLogo();
  const $logoImg = new Image();
  $logoImg.onload = () => {
    $logoImg.alt = hotel.name;
    $logoImg.className = 'ak-nav-logo-img';
    $navLogo.replaceChildren($logoImg);
    revealNavLogo();
  };
  $logoImg.onerror = revealNavLogo;
  $logoImg.src = hotel.logo;
}
showHotelLogo();
setTimeout(revealNavLogo, 10000);

const $tripHeadingLine = document.querySelector('[data-ak="trip-heading"]');
const $tripDateLine = document.querySelector('[data-ak="trip-heading-date"]');

// Captured once, before restoreTripHeadingName() ever mutates it — the Webflow markup's own
// h2 text (e.g. "My trip to New York City") is the template; only its first word (and the city,
// for a hotel outside NYC) gets swapped.
const $headingH2 = $tripHeadingLine?.querySelector('h2') || null;
const headingTemplateText = $headingH2?.textContent ?? '';

// --- Trip heading ---
// Mirrors stay-itinerary.js's getTripCity(): a fixed hotel's own city wins, otherwise the saved
// hotel's city -- unless that hotel was left over from a fixed-hotel visit.
function isNearHotel(location, hotel) {
  if (!location) return false;
  const { lat, lng } = hotel.center;
  return Math.abs(location.lat - lat) < 0.005 && Math.abs(location.lng - lng) < 0.005;
}

function isLeftoverFixedHotel(hotel) {
  if (hotel.fixedHotel) return true;
  if (hotel.guestPicked) return false;
  return Object.values(FIXED_HOTELS).some(entry => isNearHotel(hotel.location, entry));
}

function getTripCity() {
  if (fixedHotel?.city) return fixedHotel.city;
  let hotel;
  try { hotel = JSON.parse(localStorage['ak-hotel'] || 'null'); } catch (e) { hotel = null; }
  if (!hotel?.city) return '';
  if (fixedHotel ? !isNearHotel(hotel.location, fixedHotel) : isLeftoverFixedHotel(hotel)) return '';
  return hotel.city;
}

// Returns true only if a trip name was actually filled in.
function restoreTripHeadingName() {
  if (!$headingH2 || !headingTemplateText) return false;
  const city = getTripCity();
  let headingText = city ? headingTemplateText.replace(/(\bto\s+).+$/i, `$1${city}`) : headingTemplateText;
  let tripName = localStorage['ak-user-name'] || auth.currentUser?.displayName?.split(/\s+/)[0] || auth.currentUser?.email?.split('@')[0] || '';
  if (tripName) {
    tripName = tripName.charAt(0).toUpperCase() + tripName.slice(1).toLowerCase();
    headingText = headingText.replace(/^\S+/, `${tripName}'s`);
  }
  $headingH2.textContent = headingText;
  return !!tripName;
}

function restoreTripDateLine() {
  const days = getTravelDayDates();
  if (!$tripDateLine || !days.length) return;

  const monthArr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmt = d => `${monthArr[d.getMonth()]} ${d.getDate()}`;

  const $children = $tripDateLine.children;
  if ($children.length < 2) return;

  // The dates are straight in the <p> here (Carlton Arms pages wrap them in an <em>).
  const $first = $children[0].querySelector('p em') || $children[0].querySelector('p');
  const $last = $children[$children.length - 1].querySelector('p em') || $children[$children.length - 1].querySelector('p');
  if ($first) $first.textContent = fmt(days[0]);
  if ($last) $last.textContent = fmt(days[days.length - 1]);
}

// --- Saved trip ---
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

// Restores whatever this user last saved to Firestore into localStorage. Nothing gets edited on this
// page, so a value already in localStorage (carried over from the earlier steps) is kept as-is and the
// DB only fills in whatever's missing locally. The Google Maps export (KMLExport scripts.js) reads the
// trip from these same keys, airports included.
async function syncWithDB() {
  const userMail = localStorage['ak-referrer-mail'] || localStorage['ak-userMail'];
  if (!userMail) return;

  const { db, doc, getDoc } = await getDb();
  const docSnap = await getDoc(doc(db, 'locationsData', `user-${userMail}`));
  if (!docSnap.exists()) return;
  const dbData = docSnap.data();

  if (!localStorage['ak-travel-days'] && dbData.travelDates) localStorage['ak-travel-days'] = dbData.travelDates;
  if (!localStorage['ak-user-name'] && dbData.tripName) localStorage['ak-user-name'] = dbData.tripName;
  if (!localStorage['ak-attractions-saved'] && dbData.savedAttractions) localStorage['ak-attractions-saved'] = dbData.savedAttractions;
  if (!localStorage['ak-hotel'] && dbData.hotel) localStorage['ak-hotel'] = dbData.hotel;
  if (!localStorage['ak-arrival-airport'] && dbData.arrivalAirport) localStorage['ak-arrival-airport'] = dbData.arrivalAirport;
  if (!localStorage['ak-departure-airport'] && dbData.departureAirport) localStorage['ak-departure-airport'] = dbData.departureAirport;

  // This browser doesn't know the trip's hotel (another device, cleared storage): take it from the
  // trip -- stayHotel, or for trips saved before that, the key stay-itinerary.js put on the saved hotel.
  if (!localStorage['ak-stay-hotel']) {
    let savedHotel = null;
    try { savedHotel = JSON.parse(dbData.hotel || 'null'); } catch (e) {}
    const tripHotelKey = dbData.stayHotel || (FIXED_HOTELS[savedHotel?.fixedHotel] ? savedHotel.fixedHotel : '');
    if (tripHotelKey) {
      localStorage['ak-stay-hotel'] = tripHotelKey;
      if (FIXED_HOTELS[tripHotelKey] && !fixedHotel) {
        fixedHotel = FIXED_HOTELS[tripHotelKey];
        showHotelLogo();
      }
    }
  }
}

// --- Auto-email the Smart Guide PDF on landing ---
// Same as the hotel download-guide pages: once per browser session, deferred to an idle moment so it
// doesn't compete with the page loading. It calls the same generateAdvancedItineraryPdf Cloud Function
// the Smart Guide button uses; sendEmail:true makes it email the PDF (and the Google Maps file) instead
// of returning it, so nothing downloads here. The server skips a repeat send if the trip hasn't
// changed since the last email (guideEmailedSnapshot), and refuses an empty itinerary.
function emailSmartGuideOnLanding(user) {
  const flagKey = `ak-guide-emailed-${user.email}`;
  if (sessionStorage.getItem(flagKey)) return;
  sessionStorage.setItem(flagKey, '1');

  const fire = async () => {
    try {
      const { functions, httpsCallable } = await getFunctionsMod();
      const generateAdvancedItineraryPdf = httpsCallable(functions, 'generateAdvancedItineraryPdf', { timeout: 120000 });
      await generateAdvancedItineraryPdf({ userId: `user-${user.email}`, sendEmail: true, hotel: getGuideHotel() });
    } catch (err) {
      // Let a later landing in this tab retry (e.g. no saved itinerary yet, or a timeout).
      sessionStorage.removeItem(flagKey);
      console.error('Failed to email Smart Guide on landing:', err);
    }
  };

  if ('requestIdleCallback' in window) {
    requestIdleCallback(fire, { timeout: 5000 });
  } else {
    setTimeout(fire, 2000);
  }
}

// --- Cross-button click lock: Smart Guide downloads + Google Maps export share this ---
// stripe-purchase.js and KMLExport/scripts.js each disable the buttons in their own group while a
// download runs, and set `.disabled` back to false when done. This extends that lock across all the
// groups, using the clicked button's own `disabled` as the signal that its flow has finished.
// (Same as the hotel download-guide pages, plus the flagship guide button.)
function wireDownloadButtonLock() {
  const selector = '[data-ak-download-guide="true"], [data-ak="download-flagship-smart-guide"], [data-ak="download-google-maps-btn"]';

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

// --- Redirect when signed out ---
function siblingPagePath(targetSlug) {
  const segments = window.location.pathname.split('/').filter(Boolean);
  segments[segments.length - 1] = targetSlug;
  return '/' + segments.join('/');
}

function redirectToStep1(message) {
  showRedirectLoader(message);
  setTimeout(() => { window.location.href = siblingPagePath('itinerary'); }, 1500);
}

function showRedirectLoader(message) {
  if (!document.getElementById('sg-spinner-style')) {
    const style = document.createElement('style');
    style.id = 'sg-spinner-style';
    style.textContent = "@keyframes sg-spin { to { transform: rotate(360deg); } }";
    document.head.appendChild(style);
  }
  const overlay = document.createElement('div');
  overlay.id = 'sg-loader-overlay';
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0',
    background: 'rgba(255,255,255,0.5)',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    gap: '12px', zIndex: '9999',
  });
  [ 'Redirecting...', message ].forEach(text => {
    const p = document.createElement('p');
    p.textContent = text;
    Object.assign(p.style, { margin: '0', fontSize: '14px', color: '#111' });
    overlay.appendChild(p);
  });
  const spinner = document.createElement('div');
  Object.assign(spinner.style, {
    width: '40px', height: '40px',
    border: '4px solid #e5e7eb', borderTopColor: '#111',
    borderRadius: '50%', animation: 'sg-spin 0.7s linear infinite',
  });
  overlay.appendChild(spinner);
  document.body.appendChild(overlay);
}

// --- Start ---
// Everything here reads only localStorage, which is already filled in when coming from the earlier
// steps, so render straight away.
restoreTripDateLine();
$tripDateLine?.removeAttribute('data-ak-skeleton-pulse');
if (restoreTripHeadingName()) $tripHeadingLine?.removeAttribute('data-ak-skeleton-pulse');

(async () => {
  const user = await new Promise(resolve => {
    const unsubscribe = onAuthStateChanged(auth, u => { unsubscribe(); resolve(u); });
  });
  if (!user) {
    redirectToStep1('User not logged in');
    return;
  }

  // Bridge: keep ak-userMail consistent with the signed-in account (mirrors stay-itinerary.js).
  localStorage['ak-userMail'] = user.email;
  restoreTripHeadingName();
  $tripHeadingLine?.removeAttribute('data-ak-skeleton-pulse');

  try {
    await syncWithDB();
  } catch (err) {
    console.error('Could not load the saved trip', err);
  }
  // Re-run in case travelDates/tripName/hotel only existed in the DB.
  restoreTripHeadingName();
  restoreTripDateLine();

  emailSmartGuideOnLanding(user);
})();
