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
  setTimeout(() => { window.location.href = siblingPagePath('itinerary'); }, 1500);
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

function populateReport() {
  const adultNum = Number(localStorage['ak-adult-num']) || 0;
  const childrenNum = Number(localStorage['ak-children-num']) || 0;
  const guestsNum = adultNum + childrenNum;

  let tripName = localStorage['ak-user-name'] || auth.currentUser?.displayName?.split(/\s+/)[0] || auth.currentUser?.email?.split('@')[0] || '';
  if (tripName) tripName = tripName.charAt(0).toUpperCase() + tripName.slice(1).toLowerCase();

  setAkText('guest-name', tripName);
  setAkText('guest-email', localStorage['ak-userMail'] || auth.currentUser?.email);
  setAkText('confirmation-num', localStorage['ak-conf'] || localStorage['ak-hotel-conf']);
  setAkText('room-type', localStorage['ak-room-type']);
  setAkText('arrival-airport', localStorage['ak-arrival-airport']);
  setAkText('departure-airport', localStorage['ak-departure-airport']);
  setAkText('arrival-time', localStorage['ak-arrival-time']);
  setAkText('departure-time', localStorage['ak-departure-time']);
  setAkText('inbound-flight', localStorage['ak-inbound-flight']);
  setAkText('outbound-flight', localStorage['ak-outbound-flight']);
  if (guestsNum > 0) setAkText('guests-num', String(guestsNum));

  const range = getTravelDateRange();
  if (range) {
    setAkText('check-in-date', formatReportDate(range.startDate));
    setAkText('check-out-date', formatReportDate(range.endDate));
    setAkText('stay-nights', String(range.nights));
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const user = await new Promise(resolve => onAuthStateChanged(auth, resolve));
  if (!user) {
    redirectToStep1('User not logged in');
    return;
  }

  // Bridge: keep ak-userMail consistent so the rest of the code works unchanged (mirrors customize-itinerary.js).
  localStorage['ak-userMail'] = user.email;

  populateReport();
  await syncWithDB();
  // Re-run in case any fields only existed in the DB.
  populateReport();
});
