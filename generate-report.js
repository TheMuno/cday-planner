import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
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
const auth = getAuth(app);

// Long-polling avoids ad blockers / proxies that kill the default WebChannel streaming
// connection, which is what causes "Could not reach Cloud Firestore backend" timeouts.
let db;
try {
  db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
} catch (e) {
  db = getFirestore(app); // Firestore already initialized for this app elsewhere on the page
}

// Mirrors verify-itinerary.js's siblingPagePath() — derives a sibling page URL from this
// page's own URL instead of hardcoding the folder prefix.
function siblingPagePath(targetSlug) {
  const segments = window.location.pathname.split('/').filter(Boolean);
  segments[segments.length - 1] = targetSlug;
  return '/' + segments.join('/');
}

// Mirrors verify-itinerary.js's redirectToStep1()/showRedirectLoader().
function redirectToStep1(message) {
  showRedirectLoader(message);
  const target = window.location.host.includes('ask-khonsu-db0b39ec35e316889a947cb3ed90.webflow.io')
    ? '/itinerary-maker/itinerary-maker'
    : siblingPagePath('itinerary');
  setTimeout(() => { window.location.href = target; }, 1500);
}

function showRedirectLoader(message) {
  if (!document.getElementById('gr-spinner-style')) {
    const style = document.createElement('style');
    style.id = 'gr-spinner-style';
    style.textContent = "@keyframes gr-spin { to { transform: rotate(360deg); } }";
    document.head.appendChild(style);
  }
  const overlay = document.createElement('div');
  overlay.id = 'gr-loader-overlay';
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
    borderRadius: '50%', animation: 'gr-spin 0.7s linear infinite',
  });
  overlay.appendChild(spinner);
  document.body.appendChild(overlay);
}

// Restores whatever this user last saved to Firestore into localStorage before populateReport()
// reads those same keys — mirrors build-itinerary.js's syncWithDB(). Anything already sitting in
// localStorage (e.g. carried over from build-itinerary.js earlier in this session) is treated as
// at least as fresh as the DB copy, so DB only fills in whatever's missing locally.
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
  if (localStorage['ak-adult-num'] == null && dbData.adultNum != null) localStorage['ak-adult-num'] = dbData.adultNum;
  if (localStorage['ak-children-num'] == null && dbData.childrenNum != null) localStorage['ak-children-num'] = dbData.childrenNum;
  if (!localStorage['ak-hotel'] && dbData.hotel) localStorage['ak-hotel'] = dbData.hotel;
  if (!localStorage['ak-arrival-airport'] && dbData.arrivalAirport) localStorage['ak-arrival-airport'] = dbData.arrivalAirport;
  if (!localStorage['ak-departure-airport'] && dbData.departureAirport) localStorage['ak-departure-airport'] = dbData.departureAirport;
}

// --- data-ak population ---
// Mirrors the data-ak names used in embed-code.txt's "48-Hour Guest Alert" email template, so
// this page's on-site report stays in sync with what actually goes out in the email.
function getTravelDateRange() {
  if (!localStorage['ak-travel-days']) return null;
  let flatpickrDate;
  try {
    ({ flatpickrDate } = JSON.parse(localStorage['ak-travel-days']));
  } catch (e) {
    return null;
  }
  if (!flatpickrDate) return null;

  const [startRaw, endRaw] = flatpickrDate.split(/\s+to\s+/);
  const startDate = new Date(startRaw);
  const endDate = new Date(endRaw || startRaw);
  if (isNaN(startDate) || isNaN(endDate)) return null;

  const msPerDay = 24 * 60 * 60 * 1000;
  const nights = Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / msPerDay));
  return { startDate, endDate, nights };
}

function formatReportDate(date) {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// Sets an element's content from localStorage only when that key is actually present, leaving
// the template's fallback markup untouched otherwise — matches the "if available" behavior of
// the rest of this codebase (e.g. build-itinerary.js's syncWithDB()) rather than blanking fields
// this page has no data for.
function setAkText(selector, value) {
  if (value === undefined || value === null || value === '') return;
  document.querySelectorAll(`[data-ak="${selector}"]`).forEach($el => {
    if ($el.tagName === 'A') {
      if ($el.hasAttribute('href')) $el.href = `mailto:${value}`;
      $el.textContent = value;
    } else {
      $el.textContent = value;
    }
  });
}

// Mirrors verify-itinerary.js's restoreTripHeadingName() — the one field here that has no
// localStorage-only source (it falls back to the Firebase user object), so it's kept out of
// populateReport() and only ever called once auth has actually resolved.
function populateGuestName() {
  if (!auth.currentUser) return;
  let tripName = auth.currentUser.displayName || localStorage['ak-user-name'] || auth.currentUser.email?.split('@')[0] || '';
  if (tripName) {
    tripName = tripName
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
  setAkText('guest-name', tripName);
}

// ak-arrival-airport/ak-departure-airport hold a JSON blob (place details + flight fields merged
// in by build-itinerary.js's initAirportAutocomplete saveObj), not a plain airport name — parse it
// so we can pull out just the pieces this report needs instead of dumping the raw blob as text.
function getAirportData(storageKey) {
  const raw = localStorage[storageKey];
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function formatFlightLabel(data) {
  if (!data) return '';
  return [data.carrierName, data.flightNumber].filter(Boolean).join(' ');
}

// Per-tag actionable guidance for Module 3's "CONCIERGE TIP" copy, keyed by the same curatedTag
// labels build-itinerary.js writes into ak-activity-chips (see the CURATED_EAT/SEE tag catalogs
// around updateActiveChipTags()). A tag not listed here (new catalog entry) falls back to a
// generic clause instead of leaving the tip blank.
const CONCIERGE_TIP_ACTIONS = {
  'Gluten Free': 'flag the kitchen before breakfast so gluten-free options are ready',
  'Jewish': 'have kosher-friendly recommendations on hand',
  'Classic NY': 'point them to the classic NY spots rather than tourist traps',
  'Solo Dining': 'suggest counter or bar seating over a table for one',
  'Big Groups': 'confirm large-party reservations ahead of time',
  'Pre-Theater': 'have the pre-theater dining list ready before the evening curtain',
  'Kid Friendly': 'offer early-seating recommendations rather than the late ones',
  'Pizza': 'have a few go-to pizza spots ready to recommend',
  'Italian': 'have Italian spots near the hotel on hand',
  'Lunch Under 15': 'steer them toward the budget-friendly picks',
  'LGBTQ': 'point them to LGBTQ-friendly spots nearby',
  'Desserts': 'have dessert and sweet-shop recommendations ready',
  'Coffee': 'point them to a good coffee spot near the hotel',
  'Steak': 'have a steakhouse recommendation on hand',
  'Meatless': 'flag the vegetarian/vegan-friendly options',
  'Live Music': 'have live-music venue recommendations ready for the evening',
  'Tours': 'have guided tour options ready to book',
  'Museums': 'have museum hours and ticket info on hand',
  'Historic': 'point them to nearby historic landmarks',
  'Hidden Gems': 'have a few off-the-beaten-path picks ready',
  'Observation Decks': 'have observation deck / rooftop view recommendations ready',
  'Free': 'have free things-to-do recommendations on hand',
  'Retail Stores': 'point them to nearby shopping',
  'Popular': 'have the top-rated nearby attractions ready to recommend',
  'Vintage Shopping': 'point them to nearby vintage/thrift shopping',
};

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function joinWithAnd(items) {
  if (items.length <= 1) return items.join('');
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

// Builds Module 3's "CONCIERGE TIP" copy from the same ak-activity-chips array populateActivityChips()
// renders as pills, so the two stay in sync. Chip labels come from a closed catalog build-itinerary.js
// controls, but they're still escaped before going into innerHTML as defense in depth.
function conciergeTipHtml(chips) {
  if (chips.length === 0) {
    return "No search filters on this one &mdash; keep it general, and have the concierge desk's go-to recommendations ready at check-in.";
  }
  const names = chips.map(tag => `<b>${escapeHtml(tag)}</b>`);
  const actions = chips.map(tag => CONCIERGE_TIP_ACTIONS[tag] || 'have relevant recommendations ready at the desk');
  const actionText = joinWithAnd(actions);
  const actionSentence = actionText.charAt(0).toUpperCase() + actionText.slice(1);
  return `They filtered for ${joinWithAnd(names)} &mdash; ${actionSentence}.`;
}

// Wires the "TRAVELER INTENT" section and Module 3's "CONCIERGE TIP" from build-itinerary.js's
// ak-activity-chips (a JSON array of curated tag strings, e.g. ["Gluten Free", "Pre-Theater"] —
// see updateActiveChipTags()). Follows the site-wide data-ak-hidden convention
// (*[data-ak-hidden] { display: none; }): the first [data-ak-hidden] on the page is the chip
// template, cloned once per active chip; its next sibling is the "none selected" fallback. When
// there are no chips, the template's wrapper and the "Search filters..." subtitle above it are
// hidden too, leaving only the fallback line. Doesn't depend on auth and ak-activity-chips never
// changes over the course of this page's load, so this only needs to run once.
function populateActivityChips() {
  let chips = [];
  try {
    chips = JSON.parse(localStorage['ak-activity-chips'] || '[]');
  } catch (e) {
    chips = [];
  }

  const $tip = document.querySelector('[data-ak="concierge-tip"]');
  if ($tip) $tip.innerHTML = conciergeTipHtml(chips);

  const $chipTemplate = document.querySelector('[data-ak-hidden]');
  if (!$chipTemplate) return;
  const $chipList = $chipTemplate.parentElement;
  const $subtitle = $chipList.previousElementSibling;
  const $emptyFallback = $chipList.nextElementSibling;

  if (chips.length > 0) {
    chips.forEach(tag => {
      const $chip = $chipTemplate.cloneNode(true);
      $chip.textContent = tag;
      $chip.removeAttribute('data-ak-hidden');
      $chipList.appendChild($chip);
    });
    $chipTemplate.remove();
  } else {
    $chipTemplate.remove();
    $chipList.setAttribute('data-ak-hidden', '');
    $subtitle?.setAttribute('data-ak-hidden', '');
    $emptyFallback?.removeAttribute('data-ak-hidden');
  }
}

// Everything here reads only from localStorage, so it doesn't need to wait on the Firebase auth
// round-trip — called immediately on DOMContentLoaded (matching verify-itinerary.js's pattern)
// so the report renders with real data on first paint instead of popping in all at once later.
function populateReport() {
  const hasGuestNums = localStorage['ak-adult-num'] != null || localStorage['ak-children-num'] != null;
  const adultNum = Number(localStorage['ak-adult-num']) || 0;
  const childrenNum = Number(localStorage['ak-children-num']) || 0;
  const guestsNum = hasGuestNums ? adultNum + childrenNum : 1;

  const arrivalAirport = getAirportData('ak-arrival-airport');
  const departureAirport = getAirportData('ak-departure-airport');

  setAkText('guest-email', localStorage['ak-userMail']);
  setAkText('confirmation-num', localStorage['ak-conf'] || localStorage['ak-hotel-conf']);
  setAkText('room-type', localStorage['ak-room-type'] || 'Standard');
  setAkText('arrival-airport', arrivalAirport?.displayName);
  setAkText('departure-airport', departureAirport?.displayName);
  setAkText('arrival-time', arrivalAirport?.flightTime);
  setAkText('departure-time', departureAirport?.flightTime);
  setAkText('inbound-flight', formatFlightLabel(arrivalAirport));
  setAkText('outbound-flight', formatFlightLabel(departureAirport));
  setAkText('guests-num', String(guestsNum));

  const range = getTravelDateRange();
  if (range) {
    setAkText('check-in-date', formatReportDate(range.startDate));
    setAkText('check-out-date', formatReportDate(range.endDate));
    setAkText('stay-nights', String(range.nights));
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // Doesn't depend on auth — read straight from localStorage, which is already populated in the
  // common case (syncWithDB() below only backfills it when missing) — so the report shows real
  // data immediately instead of leaving template/placeholder content up through the auth round-trip.
  populateReport();
  populateActivityChips();

  const user = await new Promise(resolve => onAuthStateChanged(auth, resolve));
  if (!user) {
    redirectToStep1('User not logged in');
    return;
  }

  // Bridge: keep ak-userMail consistent so the rest of the code works unchanged (mirrors customize-itinerary.js).
  localStorage['ak-userMail'] = user.email;
  populateGuestName();
  populateReport();

  await syncWithDB();
  // Re-run in case any fields only existed in the DB.
  populateGuestName();
  populateReport();
});
