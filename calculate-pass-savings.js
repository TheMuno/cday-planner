import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyBQPqbtlfHPLpB-JYbyxDZiugu4NqwpSeM",
    authDomain: "askkhonsu-map.firebaseapp.com",
    projectId: "askkhonsu-map",
    storageBucket: "askkhonsu-map.appspot.com",
    messagingSenderId: "266031876218",
    appId: "1:266031876218:web:ec93411f1c13d9731e93c3",
    measurementId: "G-Z7F4NJ4PHW"
};

const app  = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

const $tripHeadingLine = document.querySelector('[data-ak="trip-heading"]');
const $tripDateLine = document.querySelector('[data-ak="trip-heading-date"]');

document.addEventListener('DOMContentLoaded', async () => {
  document.querySelector('[data-ak="go-back-to-step1"]')?.addEventListener('click', e => {
    e.preventDefault();
    window.location.href = '/itinerary-maker/itinerary-maker';
  });

  document.querySelector('[data-ak="continue-to-step3"]')?.addEventListener('click', e => {
    e.preventDefault();
    window.location.href = '/itinerary-maker/verify-itinerary';
  });

  await new Promise(resolve => onAuthStateChanged(auth, resolve));

  restoreTripHeading();
  $tripHeadingLine?.removeAttribute('data-ak-skeleton-pulse');
  $tripDateLine?.removeAttribute('data-ak-skeleton-pulse');
});

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
