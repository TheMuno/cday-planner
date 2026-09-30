// Validation for the reservation look-up form (wf-form-Form-Look-up). "Customize now" checks that
// hotel, reservation number, guest last name and number of guests are all filled in; each empty
// one gets data-ak-invalid (styled by the page's <head> CSS) and its red hint shown, and the click
// is stopped. Both clear as soon as the guest fills that field in. All filled in -> on to the
// picked hotel's itinerary (or /log-in if not signed in), mirroring flow-trial.js.

const $lookupForm = document.querySelector('#wf-form-Form-Look-up');

// Reservation number and number of guests share the same id/name in Webflow, so fields are looked
// up by a data-ak attribute when present, and otherwise by the label text above them.
function findFieldByLabel(labelText) {
  const $label = [...$lookupForm.querySelectorAll('.u-width-full p')]
    .find($p => $p.textContent.trim().toLowerCase() === labelText.toLowerCase());
  return $label?.closest('.u-width-full')?.querySelector('input:not(.hide), select') || null;
}

const lookupFields = $lookupForm ? [
  $lookupForm.querySelector('[data-ak="hotel-name"]') || findFieldByLabel('Hotel'),
  $lookupForm.querySelector('[data-ak="reservation-num"]') || findFieldByLabel('Reservation number'),
  $lookupForm.querySelector('[data-ak="last-name"]') || findFieldByLabel('Guest last name'),
  $lookupForm.querySelector('[data-ak="guest-count"]') || findFieldByLabel('Number of guests'),
].filter(Boolean) : [];

// Prefill number of guests from the adults/children picked earlier (ak-adult-num /
// ak-children-num), when either is stored and the guest hasn't typed a number already.
!function prefillGuestCount() {
  const $guests = $lookupForm && ($lookupForm.querySelector('[data-ak="guest-count"]') || findFieldByLabel('Number of guests'));
  if (!$guests || $guests.value.trim()) return;
  const adults = parseInt(localStorage['ak-adult-num'], 10);
  const children = parseInt(localStorage['ak-children-num'], 10);
  if (Number.isNaN(adults) && Number.isNaN(children)) return;
  const total = (Number.isNaN(adults) ? 0 : adults) + (Number.isNaN(children) ? 0 : children);
  if (total > 0) $guests.value = total;
}();

// The red hint under a field (a [data-ak-hidden] block holding .u-text-color-red), if it has one.
function getErrorHint($field) {
  return [...$field.closest('.u-width-full')?.querySelectorAll('[data-ak-hidden]') || []]
    .find($el => $el.querySelector('.u-text-color-red')) || null;
}

function setFieldInvalid($field, invalid) {
  const $hint = getErrorHint($field);
  if (invalid) {
    $field.setAttribute('data-ak-invalid', 'true');
    $hint?.removeAttribute('data-ak-hidden');
  } else {
    $field.removeAttribute('data-ak-invalid');
    $hint?.setAttribute('data-ak-hidden', 'true');
  }
}

function validateLookupForm() {
  const emptyFields = lookupFields.filter($field => !$field.value.trim());
  lookupFields.forEach($field => setFieldInvalid($field, emptyFields.includes($field)));
  emptyFields[0]?.focus();
  return emptyFields.length === 0;
}

lookupFields.forEach($field => {
  const clearIfFilled = () => {
    if ($field.value.trim()) setFieldInvalid($field, false);
  };
  $field.addEventListener('input', clearIfFilled);
  $field.addEventListener('change', clearIfFilled);
});

// Where "Customize now" goes, by the hotel picked -- mirrors hotelMap/resolveHotel() in
// flow-trial.js. `referral` is saved as ak-hotel-referral / ak-flow-trial-hotel, same keys
// flow-trial.js sets for firebase-auth.js. Anything not matched (e.g. Radio City Apartments)
// falls back to the demo hotel, same as flow-trial.js.
const hotelMap = {
  'carlton': { redirect: '/carlton-arms/itinerary', referral: 'carlton-arms' },
  'compton': { redirect: '/compton/itinerary', referral: 'compton' },
  'demo': { redirect: '/demo-hotel/itinerary', referral: 'demo' },
};

const $hotelSelect = $lookupForm && ($lookupForm.querySelector('[data-ak="hotel-name"]') || findFieldByLabel('Hotel'));
const $reservationNum = $lookupForm && ($lookupForm.querySelector('[data-ak="reservation-num"]') || findFieldByLabel('Reservation number'));

function resolveHotel() {
  const val = ($hotelSelect?.value || '').trim().toLowerCase();
  if (val.includes('carlton')) return hotelMap['carlton'];
  if (val.includes('compton')) return hotelMap['compton'];
  return hotelMap['demo'];
}

function storeFlowTrialKeys() {
  const { referral } = resolveHotel();
  localStorage.setItem('ak-hotel-referral', referral);
  localStorage.setItem('ak-flow-trial-hotel', referral);
  localStorage.setItem('ak-flow-trial-reservation', $reservationNum?.value.trim() || '');
}

const firebaseConfig = {
  apiKey:            "AIzaSyBQPqbtlfHPLpB-JYbyxDZiugu4NqwpSeM",
  authDomain:        "auth.askkhonsu.com",
  projectId:         "askkhonsu-map",
  storageBucket:     "askkhonsu-map.appspot.com",
  messagingSenderId: "266031876218",
  appId:             "1:266031876218:web:ec93411f1c13d9731e93c3",
  measurementId:     "G-Z7F4NJ4PHW",
};

// Signed-in guests go straight to their hotel's itinerary; everyone else to /log-in, same as
// flow-trial.js. Firebase is loaded lazily but started right away, so it's usually settled by the
// time anyone clicks.
const authReady = !$lookupForm ? null : Promise.all([
  import('https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js'),
  import('https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js'),
]).then(async ([{ initializeApp, getApps, getApp }, { getAuth }]) => {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  await auth.authStateReady();
  return auth;
});

let continuing = false;

async function continueToHotel() {
  if (continuing || !validateLookupForm()) return;
  continuing = true;

  storeFlowTrialKeys();

  let signedIn = false;
  try {
    signedIn = !!(await authReady)?.currentUser;
  } catch (err) {
    // Firebase failed to load -- /log-in sorts out an already-signed-in user on its own.
    console.error('Failed to check sign-in state:', err);
  }
  window.location.href = signedIn ? resolveHotel().redirect : '/log-in';
}

// Bfcache can restore the page with `continuing` still set -- reset it so the button works again.
window.addEventListener('pageshow', () => { continuing = false; });

// Only "Customize now" is wired up -- "Can't find your reservation" keeps its own href.
const $customizeBtn = $lookupForm?.querySelector('[data-ak="customize-now"]');

$customizeBtn?.addEventListener('click', e => {
  e.preventDefault();
  continueToHotel();
});

// Enter in a field submits the Webflow form directly, skipping the button -- route it through
// the same check and redirect.
$lookupForm?.addEventListener('submit', e => {
  e.preventDefault();
  e.stopImmediatePropagation();
  continueToHotel();
}, true);
