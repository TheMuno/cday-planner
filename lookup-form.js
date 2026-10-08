// Validation for the reservation look-up form (wf-form-Form-Look-up). "Customize now" checks that
// travel dates, hotel, reservation number, guest last name and phone number are all filled in; each empty
// one gets data-ak-invalid (styled by the page's <head> CSS) for 2s, same as homepage.js, and its
// red hint shown (travel dates: hint only, no outline), and the click is stopped. The hint stays until the guest fills that field in (the
// outline also goes then, if it's still showing). All filled in -> on to the
// "Customize now" button's href (never /log-in).

const $lookupForm = document.querySelector('#wf-form-Form-Look-up');

// The page's [data-ak-invalid] CSS only reddens the bottom border, which on the hotel select (border
// is on its wrapper) shows as just a line, so the wrapper's border goes red instead. The travel
// dates input never gets flagged, and its focus outline (black, from the page CSS) is hidden too.
if ($lookupForm) {
  document.head.insertAdjacentHTML('beforeend', `<style>
    #wf-form-Form-Look-up [data-ak="travel-dates-form"] input,
    #wf-form-Form-Look-up [data-ak="travel-dates-form"] input:focus,
    #wf-form-Form-Look-up [data-ak="travel-dates-form"] input:focus-visible {
      outline: none !important;
    }
    #wf-form-Form-Look-up .form_field_simple:has(> select[data-ak-invalid]) {
      border-color: #e5484d !important;
    }
    #wf-form-Form-Look-up select[data-ak-invalid] {
      box-shadow: none !important;
    }
  </style>`);
}

// Fields are looked up by a data-ak attribute when present, and otherwise by the label text above
// them (Webflow ids/names aren't reliable here).
function findFieldByLabel(labelText) {
  const $label = [...$lookupForm.querySelectorAll('.u-width-full p')]
    .find($p => $p.textContent.trim().toLowerCase() === labelText.toLowerCase());
  return $label?.closest('.u-width-full')?.querySelector('input:not(.hide), select') || null;
}

// Travel dates -- for guests who land here directly rather than via the homepage. flatpickr
// (altInput: true, site-wide code) hides [data-ak="user-travel-dates"] and puts the visible input
// right after it; that visible one is what gets focused. flatpickr only adds it after this script
// has run, so it's looked up at click time rather than here. The site-wide code also saves the
// picked dates to localStorage itself, for the /stay pages.
const $datesSource = $lookupForm?.querySelector('[data-ak="user-travel-dates"]') || null;
function getDatesField() {
  return $datesSource?.nextElementSibling?.tagName === 'INPUT' ? $datesSource.nextElementSibling : $datesSource;
}

const lookupFields = $lookupForm ? [
  $lookupForm.querySelector('[data-ak="hotel-name"]') || findFieldByLabel('Hotel'),
  $lookupForm.querySelector('[data-ak="reservation-num"]') || findFieldByLabel('Reservation number'),
  $lookupForm.querySelector('[data-ak="last-name"]') || findFieldByLabel('Guest last name'),
  $lookupForm.querySelector('[data-ak="phone-number"]') || findFieldByLabel('Phone number'),
].filter(Boolean) : [];

// The red hint under each field (a [data-ak-hidden] block holding .u-text-color-red), if it has one.
// Looked up once here while every hint still has data-ak-hidden -- showing a hint removes that
// attribute, so a later lookup by it would miss the hint and never hide it again.
const errorHints = new Map(lookupFields.map($field => [
  $field,
  [...$field.closest('.u-width-full')?.querySelectorAll('[data-ak-hidden]') || []]
    .find($el => $el.querySelector('.u-text-color-red')) || null,
]));

// The dates hint ([data-ak-dates], "Select the travel dates") sits just after the dates block
// ([data-ak="travel-dates-form"]) rather than inside a .u-width-full wrapper, so it's found
// separately -- by data-ak-dates, else as that block's next sibling.
const $datesItem = $datesSource?.closest('[data-ak="travel-dates-form"]');
const $datesHint = $lookupForm?.querySelector('[data-ak-dates]') || [$datesItem?.nextElementSibling]
  .find($el => $el?.hasAttribute('data-ak-hidden') && $el.querySelector('.u-text-color-red')) || null;
function setDatesHint(show) {
  if (show) $datesHint?.removeAttribute('data-ak-hidden');
  else $datesHint?.setAttribute('data-ak-hidden', 'true');
}

// The red outline only shows for 2s (a repeat click restarts the 2s rather than stacking timers);
// the hint stays shown until the field is filled in.
function setFieldInvalid($field, invalid) {
  const $hint = errorHints.get($field);
  clearTimeout($field.akInvalidTimer);
  if (invalid) {
    $field.setAttribute('data-ak-invalid', 'true');
    $field.akInvalidTimer = setTimeout(() => $field.removeAttribute('data-ak-invalid'), 2000);
    $hint?.removeAttribute('data-ak-hidden');
  } else {
    $field.removeAttribute('data-ak-invalid');
    $hint?.setAttribute('data-ak-hidden', 'true');
  }
}

function validateLookupForm() {
  const emptyFields = lookupFields.filter($field => !$field.value.trim());
  lookupFields.forEach($field => setFieldInvalid($field, emptyFields.includes($field)));
  const datesEmpty = !!$datesSource && !$datesSource.value.trim();
  setDatesHint(datesEmpty);
  // Focusing the visible dates input opens its calendar.
  (datesEmpty ? getDatesField() : emptyFields[0])?.focus();
  return !datesEmpty && emptyFields.length === 0;
}

lookupFields.forEach($field => {
  const clearIfFilled = () => {
    if ($field.value.trim()) setFieldInvalid($field, false);
  };
  $field.addEventListener('input', clearIfFilled);
  $field.addEventListener('change', clearIfFilled);
});

// The visible dates input is readonly and flatpickr fires change on the hidden one, so the dates
// hint is cleared from there.
$datesSource?.addEventListener('change', () => {
  if ($datesSource.value.trim()) setDatesHint(false);
});

// Where "Customize now" goes, by the hotel picked -- mirrors hotelMap/resolveHotel() in
// flow-trial.js. `referral` is saved as ak-hotel-referral / ak-flow-trial-hotel, same keys
// flow-trial.js sets for firebase-auth.js. `tag` must match a key in FLOW_TRIAL_HOTELS
// (functions/index.js) to route to that hotel's own sheet. "Radio City Hall" is the demo hotel,
// and anything else not matched falls back to it too, same as flow-trial.js.
const hotelMap = {
  'carlton': { redirect: '/carlton-arms/itinerary', tag: 'carlton-arms', referral: 'carlton-arms' },
  'compton': { redirect: '/compton/itinerary', tag: 'compton-bentonville', referral: 'compton' },
  'demo': { redirect: '/demo-hotel/itinerary', tag: 'demo', referral: 'demo' },
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
  // firebase-auth.js clears the two keys above on sign-in, so the /stay pages read the hotel from this
  // one, which nothing clears (stay-itinerary.js also saves it with the trip as stayHotel).
  localStorage.setItem('ak-stay-hotel', referral);
  localStorage.setItem('ak-flow-trial-reservation', $reservationNum?.value.trim() || '');
}

// Same endpoint and payload as saveUserData() in flow-trial.js: a row on the hotel's "Upcoming
// Guests" tab. The server finds each value by its key (last+name, travel+date, phone, reservation),
// so the keys below are those fields' data-ak names. Travel dates are sent from the hidden
// flatpickr input ("2026-10-06 to 2026-10-08"), which the server reformats.
const SAVE_FLOW_TRIAL_URL = 'https://us-central1-askkhonsu-map.cloudfunctions.net/saveFlowTrialSubmission';
const [$hotelField, $reservationField, $lastNameField, $phoneField] = [
  ['hotel-name', 'Hotel'],
  ['reservation-num', 'Reservation number'],
  ['last-name', 'Guest last name'],
  ['phone-number', 'Phone number'],
].map(([ak, label]) => $lookupForm && ($lookupForm.querySelector(`[data-ak="${ak}"]`) || findFieldByLabel(label)));

function saveLookupSubmission() {
  const value = $field => $field?.value.trim() || '';
  const fields = {
    hotel: value($hotelField),
    'user-travel-dates': value($datesSource),
    'last-name': value($lastNameField),
    'phone-number': value($phoneField),
    'reservation-num': value($reservationField),
  };
  // keepalive lets the request finish after the page moves on, so the redirect doesn't wait on it.
  fetch(SAVE_FLOW_TRIAL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hotel: resolveHotel().tag, fields }),
    keepalive: true,
  }).then(res => {
    if (!res.ok) throw new Error(`saveFlowTrialSubmission responded ${res.status}`);
  }).catch(err => console.error('Failed to save look-up submission:', err));
}

// Only "Customize now" is wired up -- "Can't find your reservation" keeps its own href.
const $customizeBtn = $lookupForm?.querySelector('[data-ak="customize-now"]');

// For now, goes to the "Customize now" button's own href (set in Webflow) -- no sign-in check, so
// never /log-in. The by-hotel redirect is switched off below; uncomment it to go back to that.
function continueToHotel() {
  if (!validateLookupForm()) return;
  storeFlowTrialKeys();
  saveLookupSubmission();
  // window.location.href = resolveHotel().redirect;
  const href = $customizeBtn?.getAttribute('href');
  if (href && href !== '#') window.location.href = href;
}

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
