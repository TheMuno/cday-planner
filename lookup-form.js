// Validation for the reservation look-up form (wf-form-Form-Look-up). "Customize now" checks that
// travel dates, hotel and guest last name are filled in (reservation number and phone number are
// optional, but a phone number given must be a real one for its country); each empty or invalid
// one gets data-ak-invalid (styled by the page's <head> CSS) for 2s, same as homepage.js, and its
// red hint shown (travel dates: hint only, no outline), and the click is stopped. The hint stays until the guest fills that field in (the
// outline also goes then, if it's still showing). All filled in -> on to the
// "Customize now" button's href (never /log-in).
// On a dashboard hotel's page (KFI, /demo-welcome) the fields instead follow the hotel's dashboard
// settings, and its custom fields are added to the form (see applyDashboardForm()).

// /welcome has two copies of the form under the same id (an older one sits in a hidden section), so
// the one actually showing is used, else the first.
const $lookupForm = [...document.querySelectorAll('[id="wf-form-Form-Look-up"]')]
  .find($form => $form.getClientRects().length) || document.querySelector('#wf-form-Form-Look-up');

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

// Phone number -- intl-tel-input (from jsDelivr, so Webflow needs no extra embed) puts a country
// dropdown in front of the field, the guest types the rest of the number, and it checks the number
// is a real one for that country (right length, real area code). Until it has loaded, or if it
// fails to, the phone field only has to be filled in, as before.
const ITI_URL = 'https://cdn.jsdelivr.net/npm/intl-tel-input@29.5.3/dist';
const $phoneInput = $lookupForm && ($lookupForm.querySelector('[data-ak="phone-number"]') || findFieldByLabel('Phone number'));
let phoneIti = null;

if ($phoneInput) {
  document.head.insertAdjacentHTML('beforeend', `<link rel="stylesheet" href="${ITI_URL}/css/intlTelInput.min.css">
    <style>#wf-form-Form-Look-up .iti { display: block; width: 100%; }</style>`);
  const $itiScript = document.createElement('script');
  $itiScript.src = `${ITI_URL}/js/intlTelInput.min.js`;
  $itiScript.onload = () => {
    $phoneInput.type = 'tel';
    phoneIti = window.intlTelInput($phoneInput, {
      initialCountry: 'us',
      countryOrder: ['us', 'ca', 'gb'],
      separateDialCode: true,
      strictMode: true,
      // On the body, so the form's wrappers can't clip the open list.
      dropdownParent: document.body,
      loadUtils: () => import(`${ITI_URL}/js/utils.js`),
    });
  };
  $itiScript.onerror = () => console.error('Failed to load intl-tel-input; the phone number is only checked for being filled in.');
  document.head.appendChild($itiScript);
}

// 'empty', 'invalid' (not a real number for the picked country), or '' when fine. isValidNumber()
// is null until the number checker has loaded, which counts as fine.
function phoneProblem() {
  if (!$phoneInput.value.trim()) return 'empty';
  return phoneIti?.isValidNumber() === false ? 'invalid' : '';
}

// The phone hint says "Enter a valid phone number" for a wrong number, and its own Webflow text
// when the field is empty.
const $phoneHintText = errorHints.get($phoneInput)?.querySelector('.u-text-color-red') || null;
const phoneHintHtml = $phoneHintText?.innerHTML;
function setPhoneHintText(problem) {
  if (!$phoneHintText) return;
  if (problem === 'invalid') $phoneHintText.textContent = 'Enter a valid phone number';
  else $phoneHintText.innerHTML = phoneHintHtml;
}

// Reservation number and phone number are optional: empty is fine, but a phone number that is
// filled in still has to be a real one. Webflow's own `required` is taken off them too, or Enter
// would stop at the browser's "Please fill out this field".
// On a dashboard hotel's page these follow the hotel's dashboard settings instead (see
// applyDashboardForm()): any field there can be required, optional or hidden.
const $reservationInput = $lookupForm && ($lookupForm.querySelector('[data-ak="reservation-num"]') || findFieldByLabel('Reservation number'));
const optionalFields = new Set([$reservationInput, $phoneInput].filter(Boolean));
optionalFields.forEach($field => $field.removeAttribute('required'));
// Fields the hotel's dashboard settings hide: never checked or sent.
const hiddenFields = new Set();
// Travel dates: 'required', or from the dashboard 'optional' / 'hidden'.
let datesSetting = 'required';

const isEmpty = $field => ($field.type === 'checkbox' ? !$field.checked : !$field.value.trim());

function fieldOk($field) {
  if (hiddenFields.has($field)) return true;
  if (optionalFields.has($field) && isEmpty($field)) return true;
  // A hotel's own page (e.g. /kfi-welcome) hides the hotel select; the hotel then comes from the URL.
  if ($field === $hotelSelect && !hotelSelectShown()) return true;
  return $field === $phoneInput ? !phoneProblem() : !isEmpty($field);
}

function validateLookupForm() {
  const badFields = lookupFields.filter($field => !fieldOk($field));
  if ($phoneInput) setPhoneHintText(phoneProblem());
  lookupFields.forEach($field => setFieldInvalid($field, badFields.includes($field)));
  const datesEmpty = datesSetting === 'required' && !!$datesSource && !$datesSource.value.trim();
  setDatesHint(datesEmpty);
  // Focusing the visible dates input opens its calendar.
  (datesEmpty ? getDatesField() : badFields[0])?.focus();
  return !datesEmpty && badFields.length === 0;
}

// The phone's hint goes once the number is a real one (or the country picked makes it one).
function watchField($field) {
  const clearIfOk = () => {
    if (fieldOk($field)) setFieldInvalid($field, false);
  };
  $field.addEventListener('input', clearIfOk);
  $field.addEventListener('change', clearIfOk);
  if ($field === $phoneInput) $field.addEventListener('countrychange', clearIfOk);
}
lookupFields.forEach(watchField);

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
  // No sheet of its own in FLOW_TRIAL_HOTELS yet, so its rows go to the demo sheet. `dashboard` is
  // its hotel ID on the hotel dashboard (see saveToDashboard()).
  'kfi': { redirect: '/stay/itinerary', tag: 'king-frederik-inn', referral: 'king-frederik-inn', dashboard: 'king-frederik-inn' },
  // /demo-welcome: the demo hotel (its sheet and "Demo Hotel" on the dashboard), with no hotel of
  // its own -- the guest may name theirs (see setupDemoHotelSearch()). Kept apart from 'demo' above,
  // which /welcome's dropdown still uses as before (sheet only).
  'demo-welcome': { redirect: '/stay/itinerary', tag: 'demo', referral: 'demo', dashboard: 'demo' },
};

// /demo-welcome (and e.g. /demo-welcome-2): the hotel field is a Google hotel search instead of
// the dropdown, and optional.
const onDemoWelcome = /\/demo-welcome/i.test(window.location.pathname);

const $hotelSelect = $lookupForm && ($lookupForm.querySelector('[data-ak="hotel-name"]') || findFieldByLabel('Hotel'));
const $reservationNum = $lookupForm && ($lookupForm.querySelector('[data-ak="reservation-num"]') || findFieldByLabel('Reservation number'));

// Checked at click time, since Webflow can hide it at some breakpoints only.
function hotelSelectShown() {
  return !!$hotelSelect && $hotelSelect.getClientRects().length > 0;
}

// The picked hotel, or -- when the select is hidden, on a hotel's own page -- the page's URL
// (/kfi-welcome -> KFI).
function resolveHotel() {
  if (onDemoWelcome) return hotelMap['demo-welcome'];
  const val = (hotelSelectShown() ? $hotelSelect.value : window.location.pathname).trim().toLowerCase();
  if (val.includes('carlton')) return hotelMap['carlton'];
  if (val.includes('compton')) return hotelMap['compton'];
  if (val.includes('frederik') || val.includes('kfi')) return hotelMap['kfi'];
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
  // Same for the reservation number: the key above is cleared on sign-in, this one isn't.
  // stay-itinerary.js matches the arrival & departure times to this row in the sheet by it.
  localStorage.setItem('ak-stay-reservation', $reservationNum?.value.trim() || '');
  // The hotel picked on /demo-welcome, saved just as stay-itinerary.js saves one picked on its map
  // ("Add hotel..."), so the itinerary opens with it set. ak-update-hotel makes it win over a hotel
  // saved with the guest's trip on sign-in (see syncWithDB() there). Nothing picked: ak-hotel is
  // left alone, as on the other pages.
  if (demoPickedHotel) {
    localStorage.setItem('ak-hotel', JSON.stringify(demoPickedHotel));
    localStorage.setItem('ak-update-hotel', 'true');
  }
}

// ---- /demo-welcome hotel search ----------------------------------------------------------------
// The hotel dropdown's spot (shown, though Webflow hides it on the hotel pages) gets Google's hotel
// search, same as "Add hotel..." on /stay/itinerary. Google Maps is loaded here when the page
// doesn't already have it, with the itinerary page's key and loader. If it can't load, the field
// goes back to hidden and the form works as on /kfi-welcome, just without a hotel.
const MAPS_API_KEY = 'AIzaSyAQT67FwFjy3518JB607xsTHBq9AsWIzdA';
const PLACE_FIELDS = ['id', 'displayName', 'location', 'editorialSummary', 'types', 'formattedAddress', 'addressComponents', 'rating', 'userRatingCount', 'nationalPhoneNumber', 'regularOpeningHours', 'businessStatus', 'photos', 'websiteURI', 'priceRange'];
let demoPickedHotel = null;

function loadGoogleMaps() {
  if (window.google?.maps?.importLibrary) return;
  // Google's own loader (as in the itinerary page's embed): defines google.maps.importLibrary and
  // adds the Maps script the first time it's called.
  (g=>{var h,a,k,p="The Google Maps JavaScript API",c="google",l="importLibrary",q="__ib__",m=document,b=window;b=b[c]||(b[c]={});var d=b.maps||(b.maps={}),r=new Set,e=new URLSearchParams,u=()=>h||(h=new Promise(async(f,n)=>{await (a=m.createElement("script"));e.set("libraries",[...r]+"");for(k in g)e.set(k.replace(/[A-Z]/g,t=>"_"+t[0].toLowerCase()),g[k]);e.set("callback",c+".maps."+q);a.src=`https://maps.${c}apis.com/maps/api/js?`+e;d[q]=f;a.onerror=()=>h=n(Error(p+" could not load."));a.nonce=m.querySelector("script[nonce]")?.nonce||"";m.head.append(a)}));d[l]?console.warn(p+" only loads once. Ignoring:",g):d[l]=(f,...n)=>r.add(f)&&u().then(()=>d[l](f,...n))})({ key: MAPS_API_KEY, v: 'weekly' });
}

// Same as getCityFromAddress() in stay-itinerary.js: the hotel's city, or '' for New York City.
function cityFromAddress(addressComponents = []) {
  const find = type => addressComponents.find(c => c.types.includes(type))?.longText || '';
  const city = find('locality') || find('postal_town');
  const state = addressComponents.find(c => c.types.includes('administrative_area_level_1'))?.shortText;
  const NYC_NAMES = ['New York', 'Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'The Bronx', 'Staten Island'];
  if (state === 'NY' && (NYC_NAMES.includes(city) || (!city && NYC_NAMES.includes(find('sublocality_level_1'))))) return '';
  return city;
}

async function setupDemoHotelSearch() {
  const $hotelItem = $hotelSelect?.closest('.u-width-full');
  if (!$hotelItem) return;
  const wasHidden = $hotelItem.classList.contains('hide');
  $hotelItem.classList.remove('hide');
  // A hidden select isn't checked (see fieldOk()), so the hotel is optional. Its `required` goes too,
  // or the browser would block Enter on a field the guest can't see.
  $hotelSelect.style.display = 'none';
  $hotelSelect.removeAttribute('required');
  const $label = [...$hotelItem.querySelectorAll('p')].find($p => $p.textContent.trim().toLowerCase().startsWith('hotel'));
  if ($label) $label.textContent = 'Hotel (optional)';
  try {
    loadGoogleMaps();
    await google.maps.importLibrary('places');
    const search = new google.maps.places.PlaceAutocompleteElement({
      includedRegionCodes: ['us'],
      includedPrimaryTypes: ['lodging', 'hotel'],
    });
    search.placeholder = 'Search for your hotel...';
    search.setAttribute('data-ak', 'demo-hotel-search');
    document.head.insertAdjacentHTML('beforeend', `<style>
      gmp-place-autocomplete[data-ak="demo-hotel-search"] { display: block; width: 100%; color-scheme: light; }
    </style>`);
    $hotelSelect.insertAdjacentElement('afterend', search);
    // Typing again drops the earlier pick until a new one is chosen.
    search.addEventListener('input', () => { demoPickedHotel = null; });
    search.addEventListener('gmp-select', async ({ placePrediction }) => {
      try {
        const place = placePrediction.toPlace();
        await place.fetchFields({ fields: PLACE_FIELDS });
        const p = place.toJSON();
        // Same shape as the hotel stay-itinerary.js saves from its own hotel search.
        demoPickedHotel = {
          displayName: p.displayName, location: { lat: p.location.lat, lng: p.location.lng },
          editorialSummary: p.editorialSummary, type: p.types, placeId: p.id,
          address: p.formattedAddress || '', rating: p.rating ?? null, reviewCount: p.userRatingCount ?? null,
          phone: p.nationalPhoneNumber || '', website: p.websiteURI || p.websiteUri || '',
          openingHours: p.regularOpeningHours || null, businessStatus: p.businessStatus || null,
          priceRange: p.priceRange || null, photoUrl: place.photos?.[0]?.getURI({ maxWidth: 800 }) || '',
          city: cityFromAddress(p.addressComponents), guestPicked: true,
        };
      } catch (err) {
        demoPickedHotel = null;
        console.error('Failed to load the picked hotel:', err);
      }
    });
  } catch (err) {
    console.error('Hotel search unavailable; continuing without it:', err);
    $hotelSelect.style.display = '';
    if (wasHidden) $hotelItem.classList.add('hide');
  }
}

// ---- The hotel's dashboard form settings -------------------------------------------------------
// On a dashboard hotel's page (KFI, /demo-welcome) the form follows what the hotel set on the
// dashboard, as the widget does:
// - Travel dates, guest last name and phone number are each required ("*" after the label, as the
//   page marks them), optional or hidden, and the marketing checkbox shown or hidden. The dashboard
//   wins over Webflow: a field hidden in Webflow (its `hide` class) is shown if the hotel asks for it.
// - The hotel's custom fields are added after the phone number, in the dashboard's order, each
//   copied from the Last name field (a checkbox from the marketing checkbox) so it looks the same.
//   Two are filled in from fields this form already has, found by label (Short text), instead:
//   - "Reservation number" (or "Reservation"): the form's own reservation number field, required
//     or optional as set there. A hotel without this field doesn't ask for it, so the form's field
//     is hidden.
//   - "Guest's hotel" (or "Guest hotel"), on /demo-welcome only: the hotel picked in its hotel
//     search, so it shows on the dashboard and in its sheet row. ("Hotel" itself can't be used:
//     the dashboard keeps that sheet column for its own hotel's name.)
// "Customize now" waits for the settings (up to 3s). If they can't be loaded the form stays as it is.
// Other hotels (the /welcome dropdown) keep the form as it is.
let demoHotelFieldId = null;
let demoHotelLabel = null;
let marketingHidden = false;
let reservationFieldId = null;
const customInputs = []; // [{ field, $input }] for the custom fields added here
const RESERVATION_LABEL = /^reservation( number)?$/i;
const DEMO_HOTEL_LABEL = /^guest['’]?s? hotel$/i;
const CUSTOM_HINTS = { text: 'Fill this in', textarea: 'Fill this in', select: 'Choose an option', checkbox: 'Tick this box to continue', date: 'Enter a valid date' };

const blockOf = $field => $field?.closest('.u-width-full') || null;
const labelOf = $block => $block?.querySelector(':scope > .w-richtext p') || null;
const hideEl = $el => { if ($el) $el.style.display = 'none'; };
// The dashboard decides, so a field Webflow hides (its `hide` class) is shown when the hotel asks for it.
const showEl = $el => { if ($el) { $el.classList.remove('hide'); $el.style.display = ''; } };
// The page's labels end in "*" for a required field, and have nothing extra for an optional one.
const labelText = (text, required) => `${text.replace(/\s*(\*|\(optional\))\s*$/i, '')}${required ? '*' : ''}`;
function markRequired($label, required) {
  if ($label) $label.textContent = labelText($label.textContent, required);
}

// A built-in field set to 'required' / 'optional' / 'hidden'. Webflow's `required` comes off
// optional and hidden ones, or Enter would stop at the browser's own message.
function applySetting($field, setting, $label = labelOf(blockOf($field))) {
  if (!$field) return;
  optionalFields.delete($field);
  hiddenFields.delete($field);
  if (setting === 'hidden') {
    hiddenFields.add($field);
    hideEl(blockOf($field));
  } else {
    showEl(blockOf($field));
    if (setting === 'optional') optionalFields.add($field);
  }
  if (setting !== 'required') $field.removeAttribute('required');
  markRequired($label, setting === 'required');
}

// The custom field's block: a copy of the Last name block with its label, input and red hint.
function buildCustomField(f) {
  const $template = blockOf($lastNameField) || blockOf($phoneInput);
  if (!$template) return null;
  const $block = $template.cloneNode(true);
  $block.querySelectorAll('.hint-text.hide').forEach($el => $el.remove());
  const $hint = [...$block.querySelectorAll('[data-ak-hidden]')].find($el => $el.querySelector('.u-text-color-red')) || null;
  const $hintText = $hint?.querySelector('.u-text-color-red p') || $hint?.querySelector('.u-text-color-red');
  if ($hintText) $hintText.textContent = CUSTOM_HINTS[f.type] || 'Fill this in';
  $hint?.setAttribute('data-ak-hidden', 'true');
  const $label = labelOf($block);
  const $copied = $block.querySelector('input, select, textarea');
  const inputClass = $copied?.className || 'form_field_simple is-padding-bottom w-input';
  let $input;
  if (f.type === 'checkbox') {
    // The marketing checkbox's look, if the page has one; else Webflow's own checkbox classes.
    const $box = $marketingEl?.matches('label') ? $marketingEl.cloneNode(true)
      : Object.assign(document.createElement('label'), { className: 'w-checkbox' });
    $box.removeAttribute('data-ak');
    $box.removeAttribute('style'); // the marketing checkbox may already be hidden by the hotel's settings
    $box.classList.remove('hide');
    $box.innerHTML = '<input type="checkbox" class="w-checkbox-input"><span class="w-form-label"></span>';
    $box.querySelector('span').textContent = labelText(f.label, f.required);
    $input = $box.querySelector('input');
    $label?.closest('.w-richtext')?.replaceWith($box);
    $copied?.remove();
  } else {
    if (f.type === 'select') {
      $input = document.createElement('select');
      $input.add(new Option('Select one...', ''));
      (f.options || []).forEach(o => $input.add(new Option(String(o), String(o))));
    } else if (f.type === 'textarea') {
      $input = document.createElement('textarea');
      $input.rows = 3;
    } else {
      $input = document.createElement('input');
      $input.type = f.type === 'date' ? 'date' : 'text';
    }
    $input.className = inputClass;
    if (f.maxLength) $input.maxLength = f.maxLength;
    if ($label) $label.textContent = labelText(f.label, f.required);
    if ($copied) $copied.replaceWith($input);
    else $block.append($input);
  }
  $input.name = `c-${f.id}`;
  $input.id = `ak-c-${f.id}`;
  $input.setAttribute('data-ak-custom', f.id);
  return { $block, $input, $hint };
}

async function applyDashboardForm() {
  let data;
  try {
    const res = await fetch(dashboardUrl(`/v1/hotels/${resolveHotel().dashboard}/form`));
    data = await res.json();
    if (!res.ok || !data.success) throw new Error(`form responded ${res.status} ${data.error || ''}`);
  } catch (err) {
    console.error("Couldn't load the hotel's form settings; the form stays as it is:", err);
    return;
  }
  const settings = data.fields || {};
  const custom = (Array.isArray(data.custom) ? data.custom : [])
    .filter(f => f && typeof f.id === 'string' && typeof f.label === 'string' && CUSTOM_HINTS[f.type]);
  const textField = re => custom.find(f => f.type === 'text' && re.test(f.label.trim())) || null;

  // Travel dates
  datesSetting = ['optional', 'hidden'].includes(settings.dates) ? settings.dates : 'required';
  if (datesSetting !== 'required') $datesSource?.removeAttribute('required');
  if (datesSetting === 'hidden') {
    hideEl($datesItem);
    hideEl($datesHint);
    // The divider under the dates goes with them.
    const $next = $datesHint?.nextElementSibling || $datesItem?.nextElementSibling;
    if ($next?.classList.contains('u-line-divider')) hideEl($next);
  }
  markRequired($datesItem?.querySelector('label'), datesSetting === 'required');

  applySetting($lastNameField, ['optional', 'hidden'].includes(settings.last_name) ? settings.last_name : 'required');
  applySetting($phoneInput, ['required', 'hidden'].includes(settings.phone) ? settings.phone : 'optional');

  // Marketing checkbox (with its fine print)
  marketingHidden = settings.marketing === 'hidden';
  if (marketingHidden && $marketingEl) {
    hideEl($marketingEl);
    const $fine = $marketingEl.nextElementSibling;
    if ($fine?.className.includes('fine-print')) hideEl($fine);
    if ($marketingBox) $marketingBox.checked = false;
  }

  // Reservation number: the form's own field, or hidden when the hotel doesn't ask for it.
  const reservation = $reservationInput ? textField(RESERVATION_LABEL) : null;
  reservationFieldId = reservation?.id || null;
  if ($reservationInput) applySetting($reservationInput, reservation ? (reservation.required ? 'required' : 'optional') : 'hidden');

  // Guest's hotel: from the hotel search on /demo-welcome.
  const demoHotel = onDemoWelcome ? textField(DEMO_HOTEL_LABEL) : null;
  demoHotelFieldId = demoHotel?.id || null;
  demoHotelLabel = demoHotel?.label || null;

  // The rest are added after the phone number (or the last name), in order.
  let $after = blockOf($phoneInput) || blockOf($lastNameField);
  for (const f of custom) {
    if (f === reservation || f === demoHotel || !$after) continue;
    const built = buildCustomField(f);
    if (!built) continue;
    $after.insertAdjacentElement('afterend', built.$block);
    $after = built.$block;
    if (!f.required) optionalFields.add(built.$input);
    lookupFields.push(built.$input);
    errorHints.set(built.$input, built.$hint);
    watchField(built.$input);
    customInputs.push({ field: f, $input: built.$input });
  }
}
// Started at the end of this file, once dashboardUrl() below is defined.
let dashboardFormReady = Promise.resolve();

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

const value = $field => $field?.value.trim() || '';

// The "Accept marketing" checkbox. Webflow may put data-ak on the <input> itself or on its wrapper
// label, so the checkbox inside is used in that case. Unchecked (or missing) = not accepted.
const $marketingEl = $lookupForm?.querySelector('[data-ak="send-marketing"]');
const $marketingBox = $marketingEl?.matches('input[type="checkbox"]') ? $marketingEl
  : $marketingEl?.querySelector('input[type="checkbox"]') || null;
const marketingAccepted = () => !!$marketingBox?.checked;

// With its country code, e.g. "+1 212-555-1234". getNumber() throws until the number checker has
// loaded (and there's nothing to format when the optional phone is empty), so the typed value is
// used as-is then.
function phoneValue() {
  const phone = value($phoneField);
  try {
    if (phone && phoneIti) return phoneIti.getNumber(window.intlTelInput.NUMBER_FORMAT.INTERNATIONAL) || phone;
  } catch {}
  return phone;
}

// Hotels with a `dashboard` ID in hotelMap send the guest to the hotel dashboard (the widget
// server's POST /v1/capture, same as the widget), which saves them there and writes the sheet row
// itself. The dashboard hotel must list this website under its allowed sites. Which fields this
// form asks for comes from the same hotel's dashboard settings (see applyDashboardForm()).
// Until the dashboard is live at dashboard.askkhonsu.com, the page points this at the temporary
// server (a tunnel address that changes on restart) with, in its head code:
//   <script>window.AK_DASHBOARD_URL = 'https://random-words.trycloudflare.com';</script>
const dashboardUrl = path => `${(window.AK_DASHBOARD_URL || 'https://dashboard.askkhonsu.com').replace(/\/+$/, '')}${path}`;
const dashboardCaptureUrl = () => dashboardUrl('/v1/capture');

// true once the dashboard has saved the guest; false (not sent, or failed) means the sheet row
// still has to be written here. Awaited before the redirect, but given up on after 4s.
// The dashboard returns an edit key with each submission. It's kept here (never in a link) and sent
// with the next one, so a guest who submits again from this browser updates their details there
// instead of being saved twice.
const editKeyName = hotelId => `ak-dashboard-edit-key:${hotelId}`;

async function saveToDashboard() {
  const hotelId = resolveHotel().dashboard;
  if (!hotelId) return false;
  const [checkIn = '', checkOut = ''] = value($datesSource).split(/\s+to\s+/);
  const custom = {
    ...(reservationFieldId && value($reservationField) && { [reservationFieldId]: value($reservationField).slice(0, 200) }),
    ...(demoHotelFieldId && demoPickedHotel && { [demoHotelFieldId]: demoPickedHotel.displayName.slice(0, 200) }),
  };
  // The hotel's other custom fields (see applyDashboardForm()). Blank ones are sent too, as the
  // widget does; the dashboard keeps an earlier answer for a blank one.
  customInputs.forEach(({ field, $input }) => {
    custom[field.id] = $input.type === 'checkbox' ? $input.checked : $input.value.trim().slice(0, field.maxLength || 1000);
  });
  try {
    const res = await fetch(dashboardCaptureUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hotel_id: hotelId,
        check_in_date: checkIn.slice(0, 10),
        check_out_date: checkOut.slice(0, 10),
        guest_last_name: value($lastNameField),
        phone: phoneValue(),
        source_url: window.location.href,
        marketing_consent: marketingAccepted(),
        ...(Object.keys(custom).length && { custom }),
        edit_key: localStorage.getItem(editKeyName(hotelId)) || undefined,
        website: honeypotValue(), // the spam guard (see $honeypot)
      }),
      signal: AbortSignal.timeout(4000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) throw new Error(`capture responded ${res.status} ${data.error || ''}`);
    if (data.edit_key) localStorage.setItem(editKeyName(hotelId), data.edit_key);
    // Same key the widget sets: firebase-auth.js sends it to /v1/claim at sign-in, which adds the
    // guest's email on the dashboard.
    localStorage.setItem('ak-stay-token', new URL(data.redirect_url).searchParams.get('token') || '');
    return true;
  } catch (err) {
    console.error('Failed to save look-up submission to the dashboard; writing the sheet directly:', err);
    localStorage.removeItem('ak-stay-token');
    return false;
  }
}

// The hotel's custom answers for the sheet row written here when the dashboard save fails, as the
// dashboard sends them (sheet.js in the widget server): [{ label, value }] in the hotel's order,
// a checkbox as "Yes"/"No". saveFlowTrialSubmission puts each under a column named after its
// label (added the first time it has a value). The reservation number isn't one of them: it has
// the sheet's own column. Nothing for hotels without custom fields (or not on the dashboard).
function sheetCustomAnswers() {
  const custom = customInputs.map(({ field, $input }) => ({
    label: field.label,
    value: $input.type === 'checkbox' ? ($input.checked ? 'Yes' : 'No') : $input.value.trim().slice(0, field.maxLength || 1000),
  }));
  if (demoHotelLabel) custom.push({ label: demoHotelLabel, value: demoPickedHotel?.displayName.slice(0, 200) || '' });
  return custom.length ? { custom, customColumns: custom.map(a => a.label) } : {};
}

function saveLookupSubmission() {
  const fields = {
    // /demo-welcome: the hotel the guest picked, if any.
    hotel: demoPickedHotel?.displayName || (hotelSelectShown() ? value($hotelField) : resolveHotel().referral),
    'user-travel-dates': value($datesSource),
    'last-name': value($lastNameField),
    // With its country code, e.g. "+1 212-555-1234" (the server keeps it as text).
    'phone-number': phoneValue(),
    'reservation-num': value($reservationField),
    // Goes in the sheet's "Marketing Consent" column (the server adds it if missing). Blank when the
    // hotel's dashboard hides the checkbox, as the dashboard writes it: "not asked" isn't "No".
    'marketing-consent': marketingHidden ? '' : marketingAccepted() ? 'Yes' : 'No',
  };
  // keepalive lets the request finish after the page moves on, so the redirect doesn't wait on it
  // (except for signed-in guests, whose email is added to the row once it's written -- see
  // addSignedInEmail). Resolves true once the row is saved.
  return fetch(SAVE_FLOW_TRIAL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hotel: resolveHotel().tag, fields, ...sheetCustomAnswers() }),
    keepalive: true,
  }).then(res => {
    if (!res.ok) throw new Error(`saveFlowTrialSubmission responded ${res.status}`);
    return true;
  }).catch(err => {
    console.error('Failed to save look-up submission:', err);
    return false;
  });
}

// Guests already signed in on the Khonsu site never pass through /log-in, where firebase-auth.js
// adds the email to the guest's details, so the same is done here. Firebase starts loading as
// the page opens (not blocking anything) so it's usually ready by the click; authStateReady()
// waits for the saved sign-in to be restored. Same config as flow-trial.js / firebase-auth.js.
const SAVE_FLOW_TRIAL_OPT_IN_URL = 'https://us-central1-askkhonsu-map.cloudfunctions.net/saveFlowTrialOptIn';
const authReady = !$lookupForm ? null : Promise.all([
  import('https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js'),
  import('https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js'),
]).then(async ([{ initializeApp, getApps, getApp }, { getAuth }]) => {
  const app = getApps().length ? getApp() : initializeApp({
    apiKey: 'AIzaSyBQPqbtlfHPLpB-JYbyxDZiugu4NqwpSeM',
    authDomain: 'auth.askkhonsu.com',
    projectId: 'askkhonsu-map',
    storageBucket: 'askkhonsu-map.appspot.com',
    messagingSenderId: '266031876218',
    appId: '1:266031876218:web:ec93411f1c13d9731e93c3',
    measurementId: 'G-Z7F4NJ4PHW',
  });
  const auth = getAuth(app);
  await auth.authStateReady();
  return auth;
});
authReady?.catch(err => console.error('Failed to load Firebase sign-in:', err));

// Gives up after `ms` (resolving `fallback`), so a slow request never holds up the redirect for long.
const within = (promise, ms, fallback) =>
  Promise.race([promise, new Promise(resolve => setTimeout(() => resolve(fallback), ms))]);

// The signed-in user's Firebase ID token (proves the email to the servers), or null if signed out.
async function signedInIdToken() {
  try {
    const auth = await within(authReady, 3000, null);
    return (await auth?.currentUser?.getIdToken()) || null;
  } catch (err) {
    console.error('Failed to check sign-in state:', err);
    return null;
  }
}

// Same requests firebase-auth.js makes at sign-in. Dashboard hotels: the link token goes to
// /v1/claim, which adds the email on the dashboard and then to the sheet row (by Guest ID, once
// the dashboard's own row write is done). Other hotels: the email goes on the sheet row by
// reservation number, so it waits for that row first (as for firebase-auth.js, a guest without
// a reservation number can't be matched there). The token is used once and removed. The
// ak-flow-trial-* keys stay, so a later real sign-in still runs its usual steps (it skips rows
// that already have an email).
async function addSignedInEmail(idToken, savedOnDashboard, sheetRowSaved) {
  if (savedOnDashboard) {
    const token = localStorage.getItem('ak-stay-token');
    if (!token) return;
    localStorage.removeItem('ak-stay-token');
    fetch(dashboardUrl('/v1/claim'), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' }, // no CORS preflight, so it goes out before the redirect
      keepalive: true,
      body: JSON.stringify({ token, id_token: idToken }),
    }).catch(err => console.error('Failed to add email on the dashboard:', err));
    return;
  }
  const reservationNum = value($reservationField);
  if (!reservationNum || !(await within(sheetRowSaved, 4000, false))) return;
  fetch(SAVE_FLOW_TRIAL_OPT_IN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({ hotel: resolveHotel().referral, reservationNum, idToken }),
  }).catch(err => console.error('Failed to add email to the sheet:', err));
}

// Spam guard, as in the hotel widget: a field people never see or fill in ("website", off-screen,
// skipped by Tab, no autofill), so only bots fill it. It's sent to the dashboard, which answers a
// filled one with a pretend success and saves nothing; the sheet fallback and the sign-in email are
// skipped for it too. The bot is still sent on as usual, so it can't tell.
const $honeypot = (() => {
  if (!$lookupForm) return null;
  const $wrap = document.createElement('div');
  $wrap.setAttribute('aria-hidden', 'true');
  $wrap.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden';
  $wrap.innerHTML = '<input type="text" name="website" tabindex="-1" autocomplete="off">';
  $lookupForm.append($wrap);
  return $wrap.querySelector('input');
})();
const honeypotValue = () => $honeypot?.value || '';

// Only "Customize now" is wired up -- "Can't find your reservation" keeps its own href.
const $customizeBtn = $lookupForm?.querySelector('[data-ak="customize-now"]');

// For now, goes to the "Customize now" button's own href (set in Webflow), or /stay/itinerary when
// it has none ("#") -- no sign-in check, so never /log-in. The by-hotel redirect is switched off
// below; uncomment it to go back to that.
let submitting = false;
async function continueToHotel() {
  // A second click while the dashboard request is out would send the guest twice.
  if (submitting) return;
  submitting = true;
  // A click before the hotel's form settings are in waits for them (see applyDashboardForm()).
  await within(dashboardFormReady, 3000, null);
  if (!validateLookupForm()) {
    submitting = false;
    return;
  }
  storeFlowTrialKeys();
  const idTokenReady = signedInIdToken(); // checked while the dashboard request is out
  const savedOnDashboard = await saveToDashboard();
  // A bot that filled in the hidden field gets no sheet row and no email added (see $honeypot).
  const isBot = !!honeypotValue();
  const sheetRowSaved = savedOnDashboard || isBot ? null : saveLookupSubmission();
  const idToken = await idTokenReady;
  if (idToken && !isBot) await addSignedInEmail(idToken, savedOnDashboard, sheetRowSaved);
  // window.location.href = resolveHotel().redirect;
  const href = $customizeBtn?.getAttribute('href');
  window.location.href = href && href !== '#' ? href : '/stay/itinerary';
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

if ($lookupForm && onDemoWelcome) setupDemoHotelSearch();
if ($lookupForm && resolveHotel().dashboard) dashboardFormReady = applyDashboardForm();
