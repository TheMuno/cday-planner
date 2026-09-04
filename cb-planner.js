/**
 * planner.js
 * Add as a <script type="module"> embed in Webflow (page settings → Before </body>) on the
 * Trip Planner page, e.g. https://ask-khonsu.webflow.io/demo-hotel/trip-planner/?conf=12345678
 *
 * Reads the "conf" query param (a hotel confirmation number), saves it to localStorage as
 * "ak-hotel-conf", and sends it to the hotel-confirmations Google Sheet via the saveHotelConf
 * Cloud Function.
 *
 * Nothing about a client-side network call is guaranteed to reach the sheet — a tab can close
 * mid-request, a network blip can drop it, an extension can block it. This mitigates the common
 * failure modes instead of relying on a single fire-and-forget fetch:
 *   - fetch(..., { keepalive: true }) + retry with backoff as the primary send path, since it's
 *     the only path that gives us a response to confirm success or trigger a retry.
 *   - navigator.sendBeacon() as a last-ditch fallback on 'pagehide', for the case where the user
 *     navigates away before the fetch above ever resolves — the browser queues and delivers it
 *     even after this page is gone. (sendBeacon can't report success/failure, which is why it's
 *     the fallback and not the primary path.)
 *   - a synced flag in localStorage so a value that's already been recorded isn't re-sent (and
 *     doesn't create a duplicate row) on every reload of the same link.
 *   - failures after retries are exhausted are logged to the console instead of swallowed, so a
 *     real drop is at least visible in devtools/error reporting.
 */

const SAVE_HOTEL_CONF_URL = 'https://us-central1-askkhonsu-map.cloudfunctions.net/saveHotelConf';
const SYNCED_KEY = 'ak-hotel-conf-synced';

// Compton Bentonville's fixed hotel coords — mirrors the comptonBentonville const in
// build-itinerary.js. The Trip Planner page's hotel is fixed too, so there's no autocomplete,
// just a centered map with the hotel pin dropped on it and a Text Search (same query/bias as
// build-itinerary.js's autoSetComptonHotel()) to resolve the same rich Place data for its popup.
const comptonBentonville = { lat: 36.3720385, lng: -94.2075697 };
const hotelMarkerPinUrl = 'https://cdn.prod.website-files.com/671ae7755af1656d8b2ea93c/68879b831dec5947617d34e3__hotel.png';
const insiderTipsUrl = 'https://us-central1-askkhonsu-map.cloudfunctions.net/getInsiderTips';
const noPhotoPlaceholder = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400"><rect width="800" height="400" fill="#ece9e4"/><circle cx="400" cy="185" r="60" fill="none" stroke="#aaa" stroke-width="3"/><g transform="translate(380,165) scale(1.667)"><path d="M12 15.2c1.77 0 3.2-1.43 3.2-3.2S13.77 8.8 12 8.8 8.8 10.23 8.8 12s1.43 3.2 3.2 3.2zM9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" fill="#bbb"/></g></svg>')}`;

let insiderTipsData = null;

if (window.location.href.includes('compton')) {
  initComptonMap();
  loadInsiderTips();
}

async function initComptonMap() {
  const $map = document.querySelector('[data-ak="map"]');
  if (!$map) return;

  const { Map } = await google.maps.importLibrary('maps');
  await google.maps.importLibrary('marker');
  await google.maps.importLibrary('places');

  const map = new Map($map, {
    zoom: 15,
    center: comptonBentonville,
    mapId: 'DEMO_MAP_ID',
    mapTypeControl: false,
  });

  const markerPinImg = document.createElement('img');
  markerPinImg.src = hotelMarkerPinUrl;
  markerPinImg.className = 'ak-marker-pin';

  const marker = new google.maps.marker.AdvancedMarkerElement({
    map,
    position: comptonBentonville,
    title: 'The Compton Bentonville',
    content: markerPinImg,
    gmpClickable: true,
  });

  document.querySelector('[data-ak="map-popup"]')?.querySelector('.map-popup-close')?.addEventListener('click', () => {
    document.querySelector('[data-ak="map-popup"]')?.setAttribute('data-ak-hidden', 'true');
  });

  // Resolved once up front (not on every click) since the hotel is fixed and its data doesn't
  // change between clicks.
  const saveObj = await resolveHotelPlace();
  marker.addListener('gmp-click', () => openHotelPopup(saveObj));
}

// Same Text Search query/bias/fields as build-itinerary.js's autoSetComptonHotel() — kept in
// sync deliberately so both pages resolve the same Place data for the same fixed hotel.
async function resolveHotelPlace() {
  const { places } = await google.maps.places.Place.searchByText({
    textQuery: 'The Compton Bentonville',
    fields: ['id', 'displayName', 'location', 'editorialSummary', 'types', 'formattedAddress', 'rating', 'userRatingCount', 'nationalPhoneNumber', 'regularOpeningHours', 'businessStatus', 'photos', 'websiteURI', 'priceRange'],
    locationBias: { radius: 200.0, center: comptonBentonville },
    maxResultCount: 1,
  });

  const place = places?.[0];
  if (!place) return null;

  const placeObj = place.toJSON();
  const photoUrl = place.photos?.[0]?.getURI({ maxWidth: 800 }) || '';

  return {
    displayName: placeObj.displayName,
    editorialSummary: placeObj.editorialSummary,
    placeId: placeObj.id,
    address: placeObj.formattedAddress || '',
    rating: placeObj.rating ?? null,
    reviewCount: placeObj.userRatingCount ?? null,
    phone: placeObj.nationalPhoneNumber || '',
    website: placeObj.websiteURI || placeObj.websiteUri || '',
    openingHours: placeObj.regularOpeningHours || null,
    businessStatus: placeObj.businessStatus || null,
    priceRange: placeObj.priceRange || null,
    photoUrl,
  };
}

// Mirrors build-itinerary.js's openMapPopup() card rendering (same [data-ak="map-popup"]
// markup/selectors, so it looks identical: image, rating, reviews, address, hours, phone,
// price, open/closed badge, insider tip). This page has no itinerary to add/remove into, so
// the add/remove action button from that version is dropped here rather than wired to nothing.
function openHotelPopup(saveObj) {
  const $mapPopup = document.querySelector('[data-ak="map-popup"]');
  if (!$mapPopup || !saveObj) return;

  const $locationBlock = $mapPopup.querySelector('.map_card_content > .map_card_title:first-child');
  if (!$locationBlock) return;

  const $titleEl = $locationBlock.querySelector('.u-size-56-28 h2');
  if ($titleEl) $titleEl.textContent = saveObj.displayName || '';
  const $descEl = $locationBlock.querySelector('.u-size-56-28 + .u-size-24-10 p');
  if ($descEl) $descEl.textContent = saveObj.editorialSummary || saveObj.displayName || '';

  const $img = $mapPopup.querySelector('.map_card_img_item');
  if ($img) showImageWithSpinner($img, saveObj.photoUrl || noPhotoPlaceholder);

  const $ratingNum = $locationBlock.querySelector('.map_card_stars_wrap + .u-size-24-10 p em');
  if ($ratingNum) $ratingNum.textContent = saveObj.rating != null ? saveObj.rating : '';

  const $reviewCount = $locationBlock.querySelector('.map_card_info .u-hflex-left-center:last-child .u-size-24-10:first-child p');
  if ($reviewCount) $reviewCount.textContent = saveObj.reviewCount != null ? saveObj.reviewCount.toLocaleString() : '0';

  const $keyItems = $mapPopup.querySelectorAll('.map_card_key .map_card_key_iem');

  const $address = $keyItems[0]?.querySelector('.u-size-24-10 p');
  if ($address) $address.textContent = saveObj.address || '';
  if ($keyItems[0]) $keyItems[0].style.display = saveObj.address ? '' : 'none';

  const $hours = $keyItems[1]?.querySelector('.u-size-24-10 p');
  const hoursVal = getTodayHours(saveObj.openingHours);
  if ($hours) $hours.textContent = hoursVal;
  if ($keyItems[1]) $keyItems[1].style.display = hoursVal ? '' : 'none';

  const $phone = $keyItems[2]?.querySelector('.u-size-24-10 p');
  if ($phone) $phone.textContent = saveObj.phone || '';
  if ($keyItems[2]) $keyItems[2].style.display = saveObj.phone ? '' : 'none';

  const $price = $keyItems[3]?.querySelector('.u-size-24-10 p');
  const priceVal = formatPriceRange(saveObj.priceRange);
  if ($price) $price.textContent = priceVal;
  if ($keyItems[3]) $keyItems[3].style.display = priceVal ? '' : 'none';

  const $closedBadge = $locationBlock.querySelector('.map_card_closed');
  if ($closedBadge) {
    const $badgeText = $closedBadge.querySelector('p');
    const status = saveObj.businessStatus;
    if (status === 'TEMPORARILY_CLOSED') {
      if ($badgeText) { $badgeText.textContent = 'Temporarily Closed'; $badgeText.style.color = '#E07B00'; }
      $closedBadge.style.display = '';
    } else if (status === 'PERMANENTLY_CLOSED') {
      if ($badgeText) { $badgeText.textContent = 'Permanently Closed'; $badgeText.style.color = '#D0021B'; }
      $closedBadge.style.display = '';
    } else if (status === 'OPERATIONAL') {
      const openNow = isCurrentlyOpen(saveObj.openingHours);
      const isOpen = openNow !== false; // null (no hours data) defaults to open
      if ($badgeText) { $badgeText.textContent = isOpen ? 'Open' : 'Currently Closed'; $badgeText.style.color = isOpen ? '#2E7D32' : '#D0021B'; }
      $closedBadge.style.display = '';
    } else {
      $closedBadge.style.display = 'none';
    }
  }

  const $tipDesc = $mapPopup.querySelector('[data-ak="insider-tip-desc"]');
  const $tipInsiders = $mapPopup.querySelectorAll('[data-ak-insider]');
  const rawEntry = insiderTipsData && saveObj.placeId ? (insiderTipsData[saveObj.placeId] ?? null) : null;
  const rawTip = rawEntry?.tip || null;
  const reservationsRequired = rawEntry?.reservationsRequired ?? false;

  let $resBadge = $mapPopup.querySelector('[data-ak="reservation-badge"]');
  if (!$resBadge && $tipDesc) {
    $resBadge = document.createElement('p');
    $resBadge.setAttribute('data-ak', 'reservation-badge');
    $resBadge.style.cssText = 'display:none;color:#92400E;border-radius:4px;padding:6px 0;font-size:12px;font-weight:600;margin-bottom:12px;';
    $resBadge.textContent = '⚠️ Reservation Required';
    $tipDesc.parentElement.insertBefore($resBadge, $tipDesc);
  }
  if ($resBadge) $resBadge.style.display = reservationsRequired ? '' : 'none';

  if (rawTip || reservationsRequired) {
    if ($tipDesc) $tipDesc.textContent = rawTip ? parseInsiderTip(rawTip).desc : '';
    $tipInsiders.forEach($el => $el.style.display = '');
  } else {
    $tipInsiders.forEach($el => $el.style.display = 'none');
  }

  // No itinerary on this page to add/remove into — hide the action button rather than wire it
  // to nothing.
  const $popupActionBtn = $mapPopup.querySelector('.map_card_btn_wrap');
  if ($popupActionBtn) $popupActionBtn.style.display = 'none';

  $mapPopup.removeAttribute('data-ak-hidden');
  requestAnimationFrame(() => {
    $mapPopup.querySelector('.map_card_-inner')?.scrollTo(0, 0);
  });
}

function showImageWithSpinner($img, src) {
  if (!document.getElementById('ak-spinner-style')) {
    const s = document.createElement('style');
    s.id = 'ak-spinner-style';
    s.textContent = '@keyframes ak-spin{to{transform:rotate(360deg)}}';
    document.head.appendChild(s);
  }
  const $container = $img.parentElement;
  $container.querySelector('.ak-img-spinner')?.remove();
  if (getComputedStyle($container).position === 'static') $container.style.position = 'relative';
  const $spinner = document.createElement('div');
  $spinner.className = 'ak-img-spinner';
  $spinner.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#ece9e4;gap:10px;z-index:1;';
  $spinner.innerHTML = '<div style="width:32px;height:32px;border:3px solid #ddd;border-top-color:#888;border-radius:50%;animation:ak-spin 0.7s linear infinite;"></div><span style="font-size:11px;color:#999;letter-spacing:0.08em;">Loading image...</span>';
  $container.appendChild($spinner);
  $img.style.opacity = '0';
  const cleanup = () => { $spinner.remove(); $img.style.opacity = ''; };
  $img.onload = cleanup;
  $img.onerror = () => { $img.src = noPhotoPlaceholder; $img.srcset = ''; cleanup(); };
  $img.src = src;
  $img.srcset = '';
}

function getTodayHours(openingHours) {
  if (!openingHours?.weekdayDescriptions?.length) return '';
  // JS getDay(): 0=Sun…6=Sat; Google weekdayDescriptions: 0=Mon…6=Sun
  const dayIndex = (new Date().getDay() + 6) % 7;
  const desc = openingHours.weekdayDescriptions[dayIndex] || '';
  const colon = desc.indexOf(':');
  return colon >= 0 ? desc.slice(colon + 1).trim() : desc;
}

function isCurrentlyOpen(openingHours) {
  if (!openingHours?.periods?.length) return null;
  const now = new Date();
  const day = now.getDay();
  const time = now.getHours() * 100 + now.getMinutes();
  for (const period of openingHours.periods) {
    if (!period.close) return true; // open 24/7
    const openDay = period.open.day;
    const closeDay = period.close.day;
    const openTime = period.open.hour * 100 + (period.open.minute || 0);
    const closeTime = period.close.hour * 100 + (period.close.minute || 0);
    if (openDay === closeDay) {
      if (day === openDay && time >= openTime && time < closeTime) return true;
    } else {
      // period spans midnight
      if (day === openDay && time >= openTime) return true;
      if (day === closeDay && time < closeTime) return true;
    }
  }
  return false;
}

function formatPriceRange(priceRange) {
  if (!priceRange) return '';
  const fmt = money => {
    if (!money) return '';
    const units = money.units ?? money.value ?? '';
    return units !== '' ? `$${units}` : '';
  };
  const start = fmt(priceRange.startPrice);
  const end = fmt(priceRange.endPrice);
  if (start && end) return `${start} - ${end}`;
  return start || end;
}

async function loadInsiderTips() {
  try {
    const res = await fetch(insiderTipsUrl);
    insiderTipsData = await res.json();
  } catch (e) {
    console.warn('Could not load insider tips:', e);
  }
}

function parseInsiderTip(raw) {
  if (!raw) return { title: '', desc: '' };
  return { title: '', desc: raw.trim() };
}

// Tags the sheet write so the backend (functions/index.js's resolveHotelConfSpreadsheetId)
// can route Compton-Bentonville rows to its own sheet instead of the shared default one.
// Same href-substring style as the compton check in captureHotelReferral() below.
function detectHotelSheetTag() {
  if (window.location.href.includes('compton')) return 'compton-bentonville';
  return null;
}

captureHotelReferral();

// Compton is checked first, ahead of the generic ?hotel= param, since its demo pages are a
// fixed URL (not driven by a query param) — see the matching compton checks in
// build-itinerary.js. Every other hotel is onboarded via a link carrying "?hotel=Hotel+Name"
// instead of a dedicated URL/page.
function captureHotelReferral() {
  if (window.location.href.includes('compton')) {
    localStorage.setItem('ak-hotel-referral', 'compton');
    return;
  }

  const hotel = new URLSearchParams(window.location.search).get('hotel');
  if (!hotel) return;

  localStorage.setItem('ak-hotel-referral', hotel);

  // Drop "hotel" from the visible URL now that it's captured — history.replaceState only
  // rewrites the address bar (no reload, no new history entry), so it can't lose the value
  // that's already saved above.
  const cleanUrl = new URL(window.location.href);
  cleanUrl.searchParams.delete('hotel');
  window.history.replaceState(window.history.state, '', cleanUrl);
}

const conf = new URLSearchParams(window.location.search).get('conf');

if (conf) {
  localStorage['ak-hotel-conf'] = conf;
  // Persisted alongside the conf itself so the login page's Saves write (firebase-auth.js's
  // recordHotelConfSave) can route to the same spreadsheet as this Views write, instead of
  // re-detecting the hotel from the login page's own URL — which doesn't reliably carry a
  // hotel-identifying substring the way this trip-planner page's URL does.
  localStorage['ak-hotel-conf-tag'] = detectHotelSheetTag() || '';

  if (localStorage[SYNCED_KEY] !== conf) {
    sendConfToSheet(conf);
    window.addEventListener('pagehide', () => sendConfBeacon(conf), { once: true });
  }

  // Drop "conf" from the visible URL now that it's captured — history.replaceState only
  // rewrites the address bar (no reload, no new history entry), so it can't lose the value
  // that's already saved above.
  const cleanUrl = new URL(window.location.href);
  cleanUrl.searchParams.delete('conf');
  window.history.replaceState(window.history.state, '', cleanUrl);
}

async function sendConfToSheet(value, attempt = 1) {
  try {
    const res = await fetch(SAVE_HOTEL_CONF_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conf: value, hotel: detectHotelSheetTag() }),
      keepalive: true,
    });
    if (!res.ok) throw new Error(`saveHotelConf responded ${res.status}`);
    localStorage[SYNCED_KEY] = value;
  } catch (err) {
    if (attempt < 3) {
      setTimeout(() => sendConfToSheet(value, attempt + 1), attempt * 500);
    } else {
      console.error('saveHotelConf failed after retries:', err);
    }
  }
}

// Fires only if sendConfToSheet above hasn't already confirmed success by the time the page
// is being unloaded. sendBeacon has no success/failure callback, so this can't mark SYNCED_KEY —
// the next page load will just re-check and, worst case, re-send once more.
function sendConfBeacon(value) {
  if (localStorage[SYNCED_KEY] === value) return;
  navigator.sendBeacon(
    SAVE_HOTEL_CONF_URL,
    new Blob([JSON.stringify({ conf: value, hotel: detectHotelSheetTag() })], { type: 'application/json' })
  );
}
