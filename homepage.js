// Hotel picker for [data-ak="hotel-autocomplete"] -- mirrors setupHotelAutocomplete() in
// build-itinerary.js (same PlaceAutocompleteElement options, same fetched fields, same saved
// shape), minus the map-only parts (panTo, hotel marker, unsaved-changes flag), since this page
// has no map. The pick is saved to localStorage as ak-hotel + ak-update-hotel, the same keys
// build-itinerary.js writes, so the itinerary page picks it up from there.
//
// Relies on the Google Maps JS API (with google.maps.importLibrary) already being loaded on the
// page, same as build-itinerary.js.

const locationNYC = { lat: 40.7580, lng: -73.9855 };

const locations = {
  new_york: { lat: 40.7580, lng: -73.9855 },
  washington_dc: { lat: 38.89511, lng: -77.03637 },
  los_angeles: { lat: 34.052235, lng: -118.243683 },
  las_vegas: { lat: 36.175, lng: -115.136 },
  miami: { lat: 25.7743, lng: -80.1937 },
};

const mapCenter = locations[localStorage['ak-user-destination']] || locationNYC;

// The shimmer on the Webflow hotel input ([data-ak-input-initial]) while the Maps autocomplete
// widget loads is pure CSS in the page's <head> custom code. This file only takes the attribute
// off once the widget has replaced the input (endHotelInputShimmer()). Read-only meanwhile, so
// nothing typed into the placeholder input gets lost when it's swapped out.
const $hotelInputInitial = document.querySelector('[data-ak-input-initial]');
if ($hotelInputInitial) $hotelInputInitial.readOnly = true;

function endHotelInputShimmer() {
  if (!$hotelInputInitial) return;
  $hotelInputInitial.removeAttribute('data-ak-input-initial');
  $hotelInputInitial.readOnly = false;
}

window.addEventListener('load', () => {
  setupHotelAutocomplete();
});

// Every [data-ak="continue-to-partner-hotel"] on the page (e.g. separate desktop/mobile buttons)
// sends the guest to its own href.
document.querySelectorAll('[data-ak="continue-to-partner-hotel"]').forEach($btn => {
  $btn.addEventListener('click', e => {
    const href = $btn.getAttribute('href');
    if (!href || href === '#') return;
    e.preventDefault();
    window.location.href = href;
  });
});

async function setupHotelAutocomplete() {
  const $target = document.querySelector('[data-ak="hotel-autocomplete"]');
  if (!$target) return;

  if (!window.google?.maps?.importLibrary) {
    console.error('homepage.js: Google Maps JS API is not loaded on this page.');
    endHotelInputShimmer();
    return;
  }

  try {
    await google.maps.importLibrary('places');
  } catch (err) {
    console.error('homepage.js: failed to load the Places library:', err);
    endHotelInputShimmer();
    return;
  }

  // On the homepage, data-ak="hotel-autocomplete" sits on the Webflow <input> itself, not on a
  // wrapper div like in build-itinerary.js. An <input> can't render children, so the widget
  // appended into it was invisible. Put the widget in a div right after the input instead. The
  // div stays hidden (and the shimmering input stays showing) until the widget is actually in it.
  let $wrap = $target;
  let placeholder = 'Add hotel...';
  if ($target.tagName === 'INPUT') {
    placeholder = $target.placeholder || placeholder;
    $wrap = document.createElement('div');
    $wrap.className = 'ak-hotel-autocomplete-wrap';
    $wrap.style.cssText = 'width:100%; display:none;';
    $target.insertAdjacentElement('afterend', $wrap);
  }

  const placeAutocomplete = new google.maps.places.PlaceAutocompleteElement({
    componentRestrictions: { country: ['us'] },
    includedRegionCodes: ['us'],
    locationBias: { radius: 5000.0, center: mapCenter },
    includedPrimaryTypes: ['lodging', 'hotel'],
  });
  placeAutocomplete.placeholder = placeholder;
  placeAutocomplete.style.width = '100%';

  getOffscreenWidgetHolder().appendChild(placeAutocomplete);

  placeAutocomplete.addEventListener('gmp-select', async res => {
    const { placePrediction } = res;
    const place = placePrediction.toPlace();
    await place.fetchFields({ fields: ['id', 'displayName', 'location', 'editorialSummary', 'types', 'formattedAddress', 'rating', 'userRatingCount', 'nationalPhoneNumber', 'regularOpeningHours', 'businessStatus', 'photos', 'websiteURI', 'priceRange'] });

    const placeObj = place.toJSON();
    const { displayName, location: { lat, lng }, editorialSummary, types: type } = placeObj;
    const photoUrl = place.photos?.[0]?.getURI({ maxWidth: 800 }) || '';

    const saveObj = { displayName, location: { lat, lng }, editorialSummary, type, placeId: placeObj.id, address: placeObj.formattedAddress || '', rating: placeObj.rating ?? null, reviewCount: placeObj.userRatingCount ?? null, phone: placeObj.nationalPhoneNumber || '', website: placeObj.websiteURI || placeObj.websiteUri || '', openingHours: placeObj.regularOpeningHours || null, businessStatus: placeObj.businessStatus || null, priceRange: placeObj.priceRange || null, photoUrl };

    // build-itinerary.js clears the input and shows the name in [data-ak="map-hotel-name"] p.
    // Do the same when that element exists here; otherwise leave the picked name in the input so
    // the guest can still see what they chose.
    const $hotelNameEl = document.querySelector('[data-ak="map-hotel-name"] p');
    if ($hotelNameEl) {
      $hotelNameEl.textContent = displayName;
      placeAutocomplete.value = '';
    } else {
      placeAutocomplete.value = displayName;
    }

    // Keep the hidden Webflow input in step, so anything reading Search-Hotel still gets the name.
    if ($target !== $wrap) $target.value = displayName;

    localStorage['ak-hotel'] = JSON.stringify(saveObj);
    localStorage['ak-update-hotel'] = true;

    document.dispatchEvent(new CustomEvent('ak-hotel-selected', { detail: saveObj }));
  });

  wireOverflowEscapeOnFocus(placeAutocomplete);

  // Swap the shimmering Webflow input out for the widget once it's placed. Drop the input's
  // `required` too, or the hidden empty input would block the form.
  const $placeholderTarget = $target !== $wrap ? $target : null;
  const onPlaced = () => {
    if ($placeholderTarget) {
      $wrap.style.display = '';
      $placeholderTarget.required = false;
      $placeholderTarget.style.display = 'none';
    }
    endHotelInputShimmer();
  };

  moveWhenVisible($wrap, placeAutocomplete, onPlaced);
}

// gmp-place-autocomplete computes its internal (closed-shadow-root) click/focus handling at the
// moment it's connected to the document. If that happens while an ancestor is display:none (e.g.
// a hover dropdown that starts hidden), that internal handling never recovers -- it renders fine
// once visible but stays permanently unclickable. So create + connect it inside a tiny
// offscreen-but-laid-out holder (NOT display:none), wire its listener there, then MOVE the
// already-working element into the real slot once that slot becomes visible.
function getOffscreenWidgetHolder() {
  let $holder = document.getElementById('ak-offscreen-widget-holder');
  if (!$holder) {
    $holder = document.createElement('div');
    $holder.id = 'ak-offscreen-widget-holder';
    $holder.style.cssText = 'position:fixed; top:0; left:-99999px; width:300px; height:44px;';
    document.body.appendChild($holder);
  }
  return $holder;
}

function findNearestClippingAncestor($el) {
  for (let node = $el.parentElement; node; node = node.parentElement) {
    const cs = getComputedStyle(node);
    if (cs.overflow !== 'visible' || cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
      return node;
    }
  }
  return null;
}

// Only relax a clipping ancestor's overflow while the widget has focus (so its suggestion
// dropdown isn't cut off), and restore it on blur.
function wireOverflowEscapeOnFocus($el) {
  let $clippingAncestor = null;
  let originalOverflow = '';
  $el.addEventListener('focusin', () => {
    $clippingAncestor = findNearestClippingAncestor($el);
    if (!$clippingAncestor) return;
    originalOverflow = $clippingAncestor.style.overflow;
    $clippingAncestor.style.overflow = 'visible';
  });
  $el.addEventListener('focusout', () => {
    if (!$clippingAncestor) return;
    $clippingAncestor.style.overflow = originalOverflow;
    $clippingAncestor = null;
  });
}

// findHiddenAncestor() starts at $wrap's parent, so $wrap's own display:none (while the shimmer
// input is still showing) doesn't count -- only a genuinely hidden container does.
function moveWhenVisible($wrap, $el, onPlaced) {
  // A Webflow ancestor may set pointer-events: none; the bare custom element has no Webflow
  // class to override it, so re-enable explicitly (a descendant's auto wins over an ancestor's none).
  $wrap.style.pointerEvents = 'auto';
  $el.style.pointerEvents = 'auto';

  const $hiddenAncestor = findHiddenAncestor($wrap);
  if (!$hiddenAncestor) {
    $wrap.appendChild($el);
    onPlaced?.();
    return;
  }

  const observer = new ResizeObserver(entries => {
    if (!entries.some(entry => entry.contentRect.width > 0 && entry.contentRect.height > 0)) return;
    observer.disconnect();
    $wrap.appendChild($el);
    onPlaced?.();
  });
  observer.observe($hiddenAncestor);
}

function findHiddenAncestor($el) {
  for (let node = $el.parentElement; node; node = node.parentElement) {
    if (getComputedStyle(node).display === 'none') return node;
  }
  return null;
}
