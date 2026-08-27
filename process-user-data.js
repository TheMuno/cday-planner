saveUserDataOnVisit();
captureHotelReferral();

function saveUserDataOnVisit() {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');
  const conf = params.get('conf');

  if (ref) localStorage['ak-ref'] = ref;
  if (conf) localStorage['ak-conf'] = conf;
}

// Carlton Arms is checked first, ahead of the generic ?hotel= param, since its
// demo pages are a fixed URL (not driven by a query param) — see the matching
// carlton-arms checks in build-itinerary.js. Every other hotel is onboarded via
// a link carrying "?hotel=Hotel+Name" instead of a dedicated URL/page.
function captureHotelReferral() {
  if (window.location.href.includes('carlton-arms')) {
    localStorage.setItem('ak-hotel-referral', 'carlton-arms');
    return;
  }

  const hotel = new URLSearchParams(window.location.search).get('hotel');
  if (hotel) localStorage.setItem('ak-hotel-referral', hotel);
}
