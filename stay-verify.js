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

// firebase-firestore.js is only needed for syncWithDB(), so it's loaded lazily (same as
// stay-itinerary.js) instead of blocking this whole module from running.
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

// Each day is a dropdown item ([data-dd-item]) in the [data-dd-group] wrap. The first one is captured
// as the template before anything touches it, so a re-render never clones an already-filled day.
const $daysWrap = document.querySelector('.dropdown_ui_wrap[data-dd-group]') || document.querySelector('[data-dd-group]');
const $dayTemplate = $daysWrap?.querySelector('[data-dd-item]')?.cloneNode(true) || null;

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

function getSavedAttractions() {
  try {
    return JSON.parse(localStorage['ak-attractions-saved'] || '{}') || {};
  } catch (e) {
    return {};
  }
}

// Restores whatever this user last saved to Firestore into localStorage. Nothing gets edited on this
// page, so a value already in localStorage (carried over from stay/itinerary) is kept as-is and the
// DB only fills in whatever's missing locally.
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

// --- Day dropdowns ---
// The page's own dropdown <script> binds every [data-dd-trigger] once, on DOMContentLoaded. This module
// runs before that, so the days from the first render get bound by it. Days from a later re-render
// (after syncWithDB()) aren't, so the handlers below toggle any day the page script didn't: the capture
// listener notes the day's state before the click, and the bubble listener toggles it only if it's
// still unchanged. Days the page script did bind are left to it, so nothing is toggled twice.
function setDayState($day, open) {
  $day.setAttribute('data-dd-item', open ? 'open' : 'closed');
  $day.querySelector('[data-dd-trigger]')?.setAttribute('aria-expanded', open);
  const $content = $day.querySelector('[data-dd-content]');
  if ($content) $content.inert = !open;
}

function toggleDay($day) {
  const willOpen = $day.getAttribute('data-dd-item') !== 'open';
  if (willOpen && $daysWrap?.hasAttribute('data-dd-single')) {
    $daysWrap.querySelectorAll('[data-dd-item]').forEach($other => {
      if ($other !== $day) setDayState($other, false);
    });
  }
  setDayState($day, willOpen);
}

function getDayFromEvent(e) {
  const $trigger = e.target.closest('[data-dd-trigger]');
  return $trigger && $daysWrap?.contains($trigger) ? $trigger.closest('[data-dd-item]') : null;
}

let dayBeforeClick = null;
document.addEventListener('click', e => {
  const $day = getDayFromEvent(e);
  dayBeforeClick = $day ? { $day, state: $day.getAttribute('data-dd-item') } : null;
}, true);

document.addEventListener('click', () => {
  const before = dayBeforeClick;
  dayBeforeClick = null;
  if (!before || before.$day.getAttribute('data-dd-item') !== before.state) return;
  toggleDay(before.$day);
});

// The page script handles Enter/Space on the triggers it bound and calls preventDefault().
document.addEventListener('keydown', e => {
  if ((e.key !== 'Enter' && e.key !== ' ') || e.defaultPrevented) return;
  const $day = getDayFromEvent(e);
  if (!$day) return;
  e.preventDefault();
  toggleDay($day);
});

// --- Day / attraction / restaurant tables ---
// Replaces the sample rows in a verify_table_wrap (keeping its header row) with one cloned row per item.
function populateVerifyTable($tableWrap, items) {
  const $rows = $tableWrap.querySelectorAll('.verify_table_row');
  const $rowTemplate = [...$rows].find($row => !$row.classList.contains('is-hotel-title')) || $rows[1];
  if (!$rowTemplate) return;

  $rows.forEach($row => { if (!$row.classList.contains('is-hotel-title')) $row.remove(); });

  items.forEach(item => {
    const $row = $rowTemplate.cloneNode(true);
    const $nameEl = $row.querySelector('.verify_table_main p');
    const [$neighborhoodEl, $addressEl] = $row.querySelectorAll('.verify_table_column p');
    if ($nameEl) $nameEl.textContent = item?.displayName || '';
    if ($neighborhoodEl) $neighborhoodEl.textContent = item?.neighborhood || '';
    if ($addressEl) $addressEl.textContent = item?.address || '';
    $tableWrap.appendChild($row);
  });
}

// One day per travel date that has attractions or restaurants; a day's Attractions/Restaurants block
// is hidden when it has none (same rule as the PDF). The first day starts open, the rest closed.
let renderedKey = null;
function populateVerifyContent() {
  if (!$daysWrap || !$dayTemplate) return;

  const key = `${localStorage['ak-travel-days'] || ''}|${localStorage['ak-attractions-saved'] || ''}`;
  if (key === renderedKey) return; // nothing new since the last render (keeps whatever's open)
  renderedKey = key;

  const days = getTravelDayDates();
  const savedAttractions = getSavedAttractions();

  $daysWrap.querySelectorAll('[data-dd-item]').forEach($el => $el.remove());

  let dayCount = 0;
  days.forEach((date, i) => {
    const slide = savedAttractions[`slide${i + 1}`] || {};
    const attractions = (slide.attractions || []).filter(Boolean);
    const restaurants = (slide.restaurants || []).filter(Boolean);
    const totalCount = attractions.length + restaurants.length;
    if (!totalCount) return;

    const $day = $dayTemplate.cloneNode(true);

    const $heading = $day.querySelector('[data-dd-trigger] h1, [data-dd-trigger] h2, [data-dd-trigger] h3');
    if ($heading) $heading.textContent = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    const $countEl = $day.querySelector('[data-dd-trigger] .u-hflex-left-bottom p');
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

    // Same accessibility setup the page script gives the days it binds.
    const $trigger = $day.querySelector('[data-dd-trigger]');
    const $content = $day.querySelector('[data-dd-content]');
    if ($content) $content.id = `ak-verify-day-${i + 1}`;
    if ($trigger) {
      $trigger.setAttribute('role', 'button');
      $trigger.setAttribute('tabindex', '0');
      if ($content) $trigger.setAttribute('aria-controls', $content.id);
    }
    setDayState($day, dayCount === 0);
    dayCount++;

    $daysWrap.appendChild($day);
  });
}

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
    borderRadius: '50%', animation: 'vi-spin 0.7s linear infinite',
  });
  overlay.appendChild(spinner);
  document.body.appendChild(overlay);
}

// --- Start ---
// Everything here reads only localStorage, which is already filled in when coming from stay/itinerary,
// so render straight away. As a module this runs after the HTML is parsed but before DOMContentLoaded,
// so the page's dropdown script then binds these days itself.
restoreTripDateLine();
$tripDateLine?.removeAttribute('data-ak-skeleton-pulse');
if (restoreTripHeadingName()) $tripHeadingLine?.removeAttribute('data-ak-skeleton-pulse');
populateVerifyContent();

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
    return;
  }
  // Re-run in case travelDates/tripName/savedAttractions only existed in the DB.
  restoreTripHeadingName();
  restoreTripDateLine();
  populateVerifyContent();
})();
