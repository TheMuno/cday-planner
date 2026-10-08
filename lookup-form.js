// Validation for the reservation look-up form (wf-form-Form-Look-up). "Customize now" checks that
// arrival/departure date & time, hotel, reservation number, guest last name and phone number are all filled in; each empty
// one gets data-ak-invalid (styled by the page's <head> CSS) for 2s, same as homepage.js, and its
// red hint shown (arrival/departure: the one dates hint only, no outline), and the click is stopped. The hint stays until the guest fills that field in (the
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

// Arrival / departure date & time. Both inputs carry data-ak="user-travel-dates", so the site-wide
// code (b.html) first sets each up as a date-range picker and writes the saved travel dates into it.
// On window load (after that code and flatpickr itself have run) each one's picker is swapped for a
// single date + time picker. The visible input (flatpickr's altInput, right after the hidden one)
// reads "Fri, Apr 3rd · 01:30 PM" (J = day with st/nd/rd/th, G = zero-padded 12-hour); the hidden
// one holds "10/29/2026 01:30 PM", which is what goes to the sheet. flatpickr-input is taken off the
// hidden inputs again so the site-wide updateFlatpickrInputs() doesn't overwrite them with the range.
// disableMobile keeps flatpickr's own calendar on phones rather than a native input.
const $arrivalSource = $lookupForm?.querySelector('[data-ak-arrival]') || null;
const $departureSource = $lookupForm?.querySelector('[data-ak-departure]') || null;
// The visible input once flatpickr has added it, else the source input itself.
function visibleInput($source) {
  return $source?.nextElementSibling?.tagName === 'INPUT' ? $source.nextElementSibling : $source;
}
// The saved travel dates' start/end (if any), only for opening each calendar on that month.
function storedTravelDays() {
  try {
    const { flatpickrDate } = JSON.parse(localStorage['ak-travel-days']);
    return flatpickrDate.split(/\s+to\s+/).map(date => new Date(date));
  } catch {
    return [];
  }
}

function initArrivalDeparturePickers() {
  if (!$lookupForm || typeof window.flatpickr !== 'function') return;
  const [storedStart, storedEnd] = storedTravelDays();
  const pickerOptions = {
    enableTime: true,
    altInput: true,
    altFormat: 'D, M J · G:i K',
    dateFormat: 'm/d/Y G:i K',
    minDate: 'today',
    minuteIncrement: 15,
    disableMobile: true,
  };
  const setUp = ($source, options, jumpTo) => {
    if (!$source) return null;
    $source._flatpickr?.destroy();
    $source.value = '';
    const picker = flatpickr($source, {
      ...pickerOptions,
      ...options,
      onOpen: (selectedDates, dateStr, instance) => {
        if (!selectedDates.length && jumpTo && !isNaN(jumpTo)) instance.jumpToDate(jumpTo);
      },
    });
    $source.classList.remove('flatpickr-input');
    // Clear the dates hint once both are picked (validation is wired up further down).
    $source.addEventListener('change', clearDatesHintIfFilled);
    return picker;
  };
  const departurePicker = setUp($departureSource, { defaultHour: 11 }, storedEnd);
  setUp($arrivalSource, {
    defaultHour: 13,
    defaultMinute: 30,
    // Departure can't be before the arrival day; one already picked that is gets cleared.
    onChange: ([arrivalDate]) => {
      if (!departurePicker) return;
      const minDay = arrivalDate ? new Date(arrivalDate).setHours(0, 0, 0, 0) : 'today';
      departurePicker.set('minDate', minDay);
      const [departureDate] = departurePicker.selectedDates;
      if (arrivalDate && departureDate && departureDate < arrivalDate) departurePicker.clear();
    },
  }, storedStart);
}
if (document.readyState === 'complete') initArrivalDeparturePickers();
else window.addEventListener('load', initArrivalDeparturePickers);

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

// The dates hint ("Select the travel dates") sits just after the last date block
// ([data-ak="travel-dates-form"]) rather than inside a .u-width-full wrapper, so it's found separately.
// It's shown when arrival or departure is missing; those two get the hint only, no outline.
const $datesItem = [...($lookupForm?.querySelectorAll('[data-ak="travel-dates-form"]') || [])].pop();
const $datesHint = [$datesItem?.nextElementSibling]
  .find($el => $el?.hasAttribute('data-ak-hidden') && $el.querySelector('.u-text-color-red')) || null;
const dateSources = [$arrivalSource, $departureSource].filter(Boolean);
const datesFilled = () => dateSources.every($source => $source.value.trim());
function clearDatesHintIfFilled() {
  if (datesFilled()) $datesHint?.setAttribute('data-ak-hidden', 'true');
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
  const emptyDate = dateSources.find($source => !$source.value.trim());
  if (emptyDate) $datesHint?.removeAttribute('data-ak-hidden');
  else $datesHint?.setAttribute('data-ak-hidden', 'true');
  // Focusing the visible date input opens its calendar.
  (emptyDate ? visibleInput(emptyDate) : emptyFields[0])?.focus();
  return !emptyDate && emptyFields.length === 0;
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
  saveTravelDays();
}

// Arrival and departure as Dates (null if not picked), from their flatpickr instances.
function pickedDates() {
  return [$arrivalSource, $departureSource].map($source => $source?._flatpickr?.selectedDates[0] || null);
}

// "2026-10-29" from a Date, in local time.
function ymd(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// The arrival and departure days become the trip's travel dates, saved under the same localStorage
// keys and in the same shapes as the site-wide travel-dates picker (formatNSaveDates() in b.html),
// which the /stay pages read.
function saveTravelDays() {
  const [arrival, departure] = pickedDates();
  if (!arrival || !departure) return;
  const days = [arrival, departure].map(date => new Date(date.getFullYear(), date.getMonth(), date.getDate()));
  const dateStr = `${ymd(days[0])} to ${ymd(days[1])}`;
  const flatpickrDate = `${ymd(days[0])}T00:00:00 to ${ymd(days[1])}T00:00:00`;
  const usrInpDate = `${days[0].toDateString().substring(0, 10)} to ${days[1].toDateString().substring(0, 10)}`;
  localStorage['ak-travel-days'] = JSON.stringify({ flatpickrDate, usrInpDate, dateStr });
  localStorage['ak-flatpickrDateObj'] = JSON.stringify({ selectedDates: days, dateStr });
  localStorage['ak-update-travel-days'] = true;
  localStorage['ak-unsaved-changes'] = true;
  localStorage['ak-numberOfWeeks'] = Math.round(Math.ceil((days[0].getTime() - Date.now()) / (1000 * 60 * 60 * 24)) / 7);
}

// Same endpoint and payload as saveUserData() in flow-trial.js: a row on the hotel's "Upcoming
// Guests" tab. The server finds each value by its key (last+name, travel+date, phone, arrival, departure, reservation),
// so the keys below are those fields' data-ak names. Travel dates are the arrival and departure days
// ("2026-10-06 to 2026-10-08", which the server reformats); arrival-time / departure-time are the
// hidden inputs' "10/06/2026 01:30 PM".
const SAVE_FLOW_TRIAL_URL = 'https://us-central1-askkhonsu-map.cloudfunctions.net/saveFlowTrialSubmission';
const [$hotelField, $reservationField, $lastNameField, $phoneField] = [
  ['hotel-name', 'Hotel'],
  ['reservation-num', 'Reservation number'],
  ['last-name', 'Guest last name'],
  ['phone-number', 'Phone number'],
].map(([ak, label]) => $lookupForm && ($lookupForm.querySelector(`[data-ak="${ak}"]`) || findFieldByLabel(label)));

function saveLookupSubmission() {
  const value = $field => $field?.value.trim() || '';
  const [arrival, departure] = pickedDates();
  const fields = {
    hotel: value($hotelField),
    'user-travel-dates': arrival && departure ? `${ymd(arrival)} to ${ymd(departure)}` : '',
    'last-name': value($lastNameField),
    'phone-number': value($phoneField),
    'arrival-time': value($arrivalSource),
    'departure-time': value($departureSource),
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
