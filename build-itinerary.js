import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, initializeFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
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

// Long-polling avoids ad blockers / proxies that kill the default WebChannel streaming
// connection, which is what causes "Could not reach Cloud Firestore backend" timeouts.
let db;
try {
  db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
} catch (e) {
  db = getFirestore(app); // Firestore already initialized for this app elsewhere on the page
}

// Reveal sign-in-to-save/continue-to-step2 as soon as auth state is known, independent of
// window 'load' (waits on every page resource, incl. images), mapReady (Maps script + library
// loads), and syncWithDB (Firestore round-trip). Those can be slow/variable on a bad connection,
// and none of them are actually needed to know which button to show — gating the reveal on them
// left the buttons invisible long enough that users would think there was nothing there.
onAuthStateChanged(auth, user => {
  const $continueBtn = document.querySelector('[data-ak="continue-to-step2"]');
  const $signInBtn = document.querySelector('[data-ak="sign-in-to-save"]');
  if (user) {
    $continueBtn?.removeAttribute('data-ak-hidden');
    $signInBtn?.setAttribute('data-ak-hidden', 'true');
  } else {
    $signInBtn?.removeAttribute('data-ak-hidden');
    $continueBtn?.setAttribute('data-ak-hidden', 'true');
  }
});

const locationNYC = { lat: 40.7580, lng: -73.9855 };
const cameraPinUrl = 'https://cdn.prod.website-files.com/671ae7755af1656d8b2ea93c/6899df6c29e5f2d2eb42bffc_cam.png';
const foodForkPinUrl = 'https://cdn.prod.website-files.com/671ae7755af1656d8b2ea93c/6899df6ccc71c7d26c3f411c_rest.png';
const hotelMarkerPinUrl = 'https://cdn.prod.website-files.com/671ae7755af1656d8b2ea93c/68879b831dec5947617d34e3__hotel.png';
const airportMarkerPinUrl = 'https://cdn.prod.website-files.com/671ae7755af1656d8b2ea93c/68879bb7f77423763223d449__airport.png';
const busPinUrl = 'https://cdn.prod.website-files.com/68935fa3de135948255cdf3b/68b9c734dec75c736ea75eaa_bus.png';
const trainPinUrl = 'https://cdn.prod.website-files.com/68935fa3de135948255cdf3b/68b9c7346b2a3e350322617a_train.png';
const restaurantPreselectPinUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADgAAAA4CAMAAACfWMssAAAACXBIWXMAAAAcAAAAHAAPAbmPAAAAulBMVEUAAAAAAAAAAAD///8AAAD////r6+sAAADQ0NBxcXFdXV2UlJT///////8AAAD///////98fHz7+/v///////////////////8AAADMzMz7+/v39/fz8/MZGRnn5+f///////////////+wsLDMzMyIiIj////7wC373Ij///v/67z/99//++/7wDH7xD37yEn7xDn70Gn/++v7zFX756z/45z72Hj/9+v71G3/46T7xDX/78j/89j/89DtKlaHAAAAJnRSTlMATT33DJDYLLRxaIAmTBPjaHXzvDDQx+shsPfz51TQ3zwINJSASBwWgW4AAAMLSURBVHja7f3FovMqFAZQxGP1eu34F6nXK//7v9YlREgoleGd7NEphxVgZ0MYSv+TKNX05kdXVbsfTb1Wele19CoKUdVbb7Byh3TdhP56uZjPF8u1H25IQ6f8gn0TNjtvvUJszzNCv5+wLx04+hfvLi7+EdC/HrlSG8FewCjdB2g/SNNnA9Ot9zC2UzQ+Ra6sIlx5T2IVQhXk6FPFbu49jfkO6t2YpQZ23svYocGt86uNcP4azkO0i7nVMV15b8RqCj3vvhE8y6fvH9K3tA2Qr4QO9sk/dncPOEyjep2dkp97dJgr45g88YRZUZJMxpFO6XJEOTegn/S7gpNhtkfCpMVnQ7YwS5cwQ1H6bHPNkqbLDK0spee0Y4CCXM0YDNLGc5bYKrKeUxTkIbedp2mfLaqxK2GTTW0fd9os45+7HGSFtUFcPrVs3Z63SOZ2jOU1B9nKQ9SSJfpZm7cO8jIUDUgyFi+yibX3QLKk3nIbfI0mhR9Y5qB3SuSVTPyWuusi12OJDwq7yLemcrpkbuMXds4CXQoDcBsqkokLTqTC19z/5wgoVHnoHQKywhV1niDmUCkcclONxowdjgsRXGBI4aiYnDhW/+jqpiK5xIjCSeF1xHEhLiBHKW4CucaEQitfAIkjJRMc6DsVSB8Whb+5kis474EM8UvhX67IM4cD/fMkkhv8UdjLbaso5swlsngAkm3Vo1Drs43MO5E8o6/FG9JmRwc9c1HIViT/5SQ5OuzYSabBet65qI5IkbMn+zDMBGpudjzSw4J/O5HM2sjx6CYzlSTFyA5kcnjcvVUi2Tbew1BSJ1Xs3CfgvozybeQTYFcyKCnW+x8diw1Ihhy//5kb5wYkiXXe/bA6plQIpT5451M+qCtFJ2myO3h9eRi4ssZBqSLXX19X6jJZ4L10Xl2QHJGL5Nh6diWzxmJH1qnItvHoEmjYsqJJj8KUZdeA4NppuLJsSk+iosiy3ecvun1blpWK9DwiKjs/1mQ0VNXhaGL9OPIbLAqNTLgYpia9GVrPVGKjmD2x+g8/BE5ERFWgyAAAAABJRU5ErkJggg==';
const cameraPreselectPinUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADgAAAA4CAMAAACfWMssAAAACXBIWXMAAAAcAAAAHAAPAbmPAAAAtFBMVEUAAAAAAAAAAAD///8AAAD///8AAADQ0NBxcXHr6+tdXV2UlJTz8/P///////8AAAD39/f///98fHz////////7+/v////////////7+/sAAADMzMz39/cZGRnn5+f///////////+wsLDMzMyIiIj////73Ij///v/67z7wDH7wC37zFX7yEn735T70Gn756z/++//46T/89z/+/P/9+v/45z/++v7xD37xDX7xDn/78z/99+JjJk3AAAAJXRSTlMATT33DJAstHHYaIDnJkwT62h1vDDz0Mfr9yGw81TQPAg0lIBINOsfYwAAAtZJREFUeNrt/ce2qkoQhgGQlGg2qztXB6LZ9P7vdRqEBklyZ3fyz2DVV6mrw1D4n6gzaI2suSzPrVFr0GlKjVt9eFG/NW6AdWfM9EyQ714ovbg+Imf2Y9Z9g30zbLtz7Bc5uy1Dv2uwrxbAEV3tgq7oCND6quI6U8CnEixCTximFW36nMDDsSvlPGDyWcZ1ZSA3u0Y3AnJJjz5lCKhdKxqAXIjZmUBgv1UAk1ydX1Mg9D1ICUxfe9uCx81uoNsDWlnuG7BjN5KDITsJMzjlDbxYeYcnmKVcF465dXe2yYQfcuT1CN1MQFTFFUmUhhzDNgl43R0PTDi7q3D457jjJlsY85buEncBVIov8443tg88m201uOV1QP/JdeDMC4AacaMzPMdnAKQU3BOyLwUJDOISUQkYuOG3G5SAKC5yBH4BxKEvGk4vwgXQh1EEWuAWQMb5d4zvfug/D7pgReAcLnlwTxN7ZNN9HrzAPAIx0DyIbDfOELs8JDeigCNQLoKO7SUJemzdCqAcgetiqm46QgErqZDquqo59RGT5nwUlwNxa+ajUKMPHxGoFgfgHo5yJDb+9zyIQI3A35KRYzl4B7YXvdB/HiTwG4F/JUMe7l7qOKzdzqEAnuEvApeZbQWcRNEaUcQ5DrJttYxAZZVuZEh1IJ5HDpkfic0OVspzQ2rp0QE1ik3Y0aE9OaGt877uq7l9bIJAb8egYvLj0cdVHI4Xmx2PZpypIEg6P5Bd5JUKJdN1Al1KOKGn/ZcrQOtxUJDU5peOmgZkITfNr7lNJiBrrNH0YjXawouk4aLJVb4YSq+coIjm4v3jYWGKSg4UeuLw/XNlKLICi6Tx7oFklHEhuVHrnmTqppxjdUqiplc9AnVNlBShSm1RNBlafHbqpii2hRr1JFHUVvmH7koTRakn1CtEReNH/bDWsry2PtQfQ2yAhVJYwq9qK0JDKcu29GSk9rKc+gfdFlLeciqJYQAAAABJRU5ErkJggg==';
const insiderTipsUrl = 'https://us-central1-askkhonsu-map.cloudfunctions.net/getInsiderTips';
const placesApiKey = 'AIzaSyAQT67FwFjy3518JB607xsTHBq9AsWIzdA';
const noPhotoPlaceholder = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400"><rect width="800" height="400" fill="#ece9e4"/><circle cx="400" cy="185" r="60" fill="none" stroke="#aaa" stroke-width="3"/><g transform="translate(380,165) scale(1.667)"><path d="M12 15.2c1.77 0 3.2-1.43 3.2-3.2S13.77 8.8 12 8.8 8.8 10.23 8.8 12s1.43 3.2 3.2 3.2zM9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" fill="#bbb"/></g></svg>')}`;

const locations = {
  new_york: { lat: 40.7580, lng: -73.9855 },
  washington_dc: { lat: 38.89511, lng: -77.03637 },
  los_angeles: { lat: 34.052235, lng: -118.243683 },
  las_vegas: { lat: 36.175, lng: -115.136 },
  miami: { lat: 25.7743, lng: -80.1937 },
};

const typeKeyMap = { visit: 'attractions', eat: 'restaurants', notes: 'notes' };
const attractionslimit = 5;

const AIRPORT_FIELDS = [
  { dataAk: 'arrival-airport-autocomplete', markerKey: 'airport-arrival', storageKey: 'ak-arrival-airport', updateKey: 'ak-update-arrival-airport', nameSelector: '[data-ak="map-arrival-name"] p', placeholder: 'Add arrival...', prefix: 'arrival', draftKey: 'ak-arrival-flight-draft' },
  { dataAk: 'departure-airport-autocomplete', markerKey: 'airport-departure', storageKey: 'ak-departure-airport', updateKey: 'ak-update-departure-airport', nameSelector: '[data-ak="map-departure-name"] p', placeholder: 'Add departure...', prefix: 'departure', draftKey: 'ak-departure-flight-draft' },
];

const placeAutocompleteEls = {};

const MAP_POPUP_FIELDS = [
  { nameSelector: '[data-ak="map-hotel-name"] p', markerKey: 'hotel', storageKey: 'ak-hotel', updateKey: 'ak-update-hotel' },
  ...AIRPORT_FIELDS.map(({ nameSelector, markerKey, storageKey, updateKey }) => ({ nameSelector, markerKey, storageKey, updateKey })),
];

const AIRPORT_FLIGHT_FIELDS = [
  { suffix: 'time', key: 'flightTime' },
  { suffix: 'carrier-name', key: 'carrierName' },
  { suffix: 'flight-number', key: 'flightNumber' },
];

const flightFieldSaveTimers = {};

const $attractionsSlider = document.querySelector('[data-ak="locations-slider"]');
const $attractionsSliderMask = $attractionsSlider.querySelector('.w-slider-mask');
const $unsavedChanges = document.querySelector('[data-ak="slider-locations-changes"]');

// [data-ak="attraction-location"] / [data-ak-type-title] / [data-ak-type-dropzone] etc. also exist
// inside the itinerary_ui_slider duplicate markup (data-ak="locations-slider-2"), so delegated
// document.body listeners need this guard — a bare closest() would happily match that slider too.
function isInAttractionsSlider($el) {
  return $el.closest('[data-ak="locations-slider"]') === $attractionsSlider;
}

const $tripHeadingLine = document.querySelector('[data-ak="trip-heading"]');
const $tripDateLine = document.querySelector('[data-ak="trip-heading-date"]');

let map;
let infoWindow;
let insiderTipsData = null;
let addedAttractions = 0;
let notesSaveTimer = null;
const markerObj = {};
const chipMarkers = {};
const attractionChipMarkers = {};
const ALL_CHIP_MARKER_CACHES = [chipMarkers, attractionChipMarkers];

// Exposed for console debugging/A-B testing (module-scoped consts aren't visible on window otherwise).
window.chipMarkers = chipMarkers;

let mapCenter = locationNYC;
if (localStorage['ak-user-destination']) {
  mapCenter = locations[localStorage['ak-user-destination']];
}

const mapReady = initMap(mapCenter);
async function initMap(center) {
  const $map = document.querySelector('[data-ak="map"]');
  const { Map, InfoWindow } = await google.maps.importLibrary('maps');
  await google.maps.importLibrary('marker');
  await google.maps.importLibrary('places');
  map = new Map($map, {
    zoom: 12,
    center,
    // mapId: 'd604d19d3ee253cb9ac6f7f8',
    mapId: 'DEMO_MAP_ID',
    mapTypeControl: false,
  });
  infoWindow = new InfoWindow();
  return map;
}


window.addEventListener('load', async () => {
  document.querySelector('[data-ak="map-popup"]')?.querySelector('.map-popup-close')?.addEventListener('click', () => {
    document.querySelector('[data-ak="map-popup"]')?.setAttribute('data-ak-hidden', 'true');
  });

  MAP_POPUP_FIELDS.forEach(field => {
    const $el = document.querySelector(field.nameSelector);
    field.defaultText = $el ? $el.textContent : '';
  });

  loadInsiderTips();

  setupAutocompleteInp();
  setupHotelAutocomplete();
  setupAirportAutocomplete();

  await new Promise(resolve => onAuthStateChanged(auth, resolve));

  // Bridge: keep ak-userMail consistent so the rest of the code works unchanged (mirrors customize-itinerary.js).
  if (auth.currentUser) localStorage['ak-userMail'] = auth.currentUser.email;

  if (auth.currentUser) localStorage.removeItem('ak-addedAttractions-count');
  addedAttractions = Number(localStorage['ak-addedAttractions-count'] || 0);

  // Travel dates/trip name come from localStorage (picked upstream, before this page ever loads)
  // or, once syncWithDB() below fills a gap, the DB — neither needs the Maps library chain or a
  // Firestore round trip to render, so show them now instead of leaving the skeleton up through
  // mapReady + syncWithDB, which is what stalled this section on slow mobile connections.
  restoreTripHeading();
  $tripHeadingLine?.removeAttribute('data-ak-skeleton-pulse');
  $tripDateLine?.removeAttribute('data-ak-skeleton-pulse');

  await syncWithDB();
  restoreTripHeading(); // re-run in case travelDates/tripName only existed in the DB

  // restoreTripDaySlides() itself only clones slides and sets day/date text from localStorage — no
  // map access — so it runs here without waiting on mapReady. Only its callback needs the map (to
  // drop markers via createMarker()), so mapReady is awaited there instead, letting the Maps library
  // chain finish loading in parallel with the slide setup + syncWithDB() above rather than after them.
  restoreTripDaySlides(async () => {
    await mapReady;
    restoreAttractions();
    restoreHotel();
    restoreAirports();
    restoreTripNotes();
    // Webflow.push() runs the callback once Webflow's own init (including IX2, which is what the
    // clicks inside unwrapSectionsWithContent() need bound) is actually ready, instead of guessing.
    if (window.Webflow) window.Webflow.push(unwrapSectionsWithContent);
    else unwrapSectionsWithContent();
  });
  if (localStorage['ak-unsaved-changes']) setUnsavedChangesFlag();

  document.querySelector('[data-ak="sign-in-to-save"]')?.addEventListener('click', e => {
    e.preventDefault();
    window.location.href = '/log-in';
  });

  const $continueBtn = document.querySelector('[data-ak="continue-to-step2"]');
  const continueBtnOriginalHTML = $continueBtn?.innerHTML;

  // Derive the next-step URL from this page's own URL rather than hardcoding the folder prefix —
  // e.g. on "/xyz/itinerary" this resolves to "/xyz/pass-calculator", so it keeps working no
  // matter what that prefix is or if it ever changes. Demo-hotel slugs skip the pass calculator
  // entirely and go straight to verify-itinerary instead.
  const pathSegments = window.location.pathname.split('/').filter(Boolean);
  const isDemoHotel = pathSegments.includes('demo-hotel');
  pathSegments[pathSegments.length - 1] = isDemoHotel ? 'verify-itinerary' : 'pass-calculator';
  const passCalculatorHref = '/' + pathSegments.join('/');

  function resetContinueBtn() {
    if (!$continueBtn) return;
    $continueBtn.classList.remove('ak-saving');
    $continueBtn.disabled = false;
    $continueBtn.style.opacity = '';
    $continueBtn.style.minWidth = '';
    $continueBtn.innerHTML = continueBtnOriginalHTML;
  }

  function resetStepLink($link) {
    delete $link.dataset.akSaving;
    $link.style.opacity = '';
    const $text = $link.querySelector('.u-body-cod');
    $text?.classList.remove('ak-step2-btn-loading');
    $text?.querySelector('.ak-step2-spinner')?.remove();
  }

  // Bfcache restores the page (and its DOM/JS state) exactly as it was when the user navigated away,
  // so without this the button (and the "Calc" breadcrumb link) can come back stuck mid-spinner if
  // they hit back after clicking it.
  window.addEventListener('pageshow', e => {
    if (!e.persisted) return;
    resetContinueBtn();
    document.querySelectorAll('[href$="/pass-calculator"]').forEach(resetStepLink);
  });

  $continueBtn?.addEventListener('click', async e => {
    e.preventDefault();
    const $btn = e.currentTarget;
    if ($btn.classList.contains('ak-saving')) return;

    if (!document.getElementById('ak-step2-spinner-style')) {
      const style = document.createElement('style');
      style.id = 'ak-step2-spinner-style';
      style.textContent = `
        @keyframes ak-step2-spin { to { transform: rotate(360deg); } }
        .ak-step2-spinner {
          display: inline-block; width: 14px; height: 14px;
          border: 2px solid currentColor; border-top-color: transparent;
          border-radius: 50%; animation: ak-step2-spin 0.7s linear infinite;
          opacity: 0.8; flex-shrink: 0;
        }
        .ak-step2-btn-loading { display: inline-flex; align-items: center; gap: 8px; }
      `;
      document.head.appendChild(style);
    }

    $btn.style.minWidth = `${$btn.getBoundingClientRect().width}px`;
    $btn.innerHTML = `<span class="ak-step2-btn-loading"><span class="ak-step2-spinner"></span>Calculating Savings...</span>`;
    $btn.classList.add('ak-saving');
    $btn.disabled = true;
    $btn.style.opacity = '0.8';

    const step2Timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000));
    try {
      await Promise.race([saveAttractionsDB(), step2Timeout]);
      window.location.href = passCalculatorHref;
    } catch (err) {
      console.error(err);
      $btn.innerHTML = 'Failed, try again!';
      $btn.classList.remove('ak-saving');
      $btn.disabled = false;
      $btn.style.opacity = '';
      setTimeout(() => { $btn.innerHTML = continueBtnOriginalHTML; $btn.style.minWidth = ''; }, 1000);

      alertify.alert(navigator.onLine
        ? "We couldn't save your trip. Please try again in a moment."
        : "You're offline — please check your internet connection and try again.");
    }
  });

  document.querySelector('.itinerary_ui_bulk_finish')?.addEventListener('click', e => {
    e.preventDefault();
    handleBulkImport();
  });

  // The "Calc" step breadcrumb link points straight at pass-calculator — without this it navigates
  // before the trip is saved, same gap continue-to-step2 used to have.
  document.querySelectorAll('[href$="/pass-calculator"]').forEach($link => {
    $link.addEventListener('click', async e => {
      e.preventDefault();
      if ($link.dataset.akSaving) return;
      $link.dataset.akSaving = 'true';
      $link.style.opacity = '0.8';

      if (!document.getElementById('ak-step2-spinner-style')) {
        const style = document.createElement('style');
        style.id = 'ak-step2-spinner-style';
        style.textContent = `
          @keyframes ak-step2-spin { to { transform: rotate(360deg); } }
          .ak-step2-spinner {
            display: inline-block; width: 14px; height: 14px;
            border: 2px solid currentColor; border-top-color: transparent;
            border-radius: 50%; animation: ak-step2-spin 0.7s linear infinite;
            opacity: 0.8; flex-shrink: 0;
          }
          .ak-step2-btn-loading { display: inline-flex; align-items: center; gap: 8px; }
        `;
        document.head.appendChild(style);
      }

      // Insert the spinner right before the "Calc" text itself, not just anywhere in the link,
      // since the link also contains the step-number bubble before it.
      const $text = $link.querySelector('.u-body-cod');
      const $spinner = document.createElement('span');
      $spinner.className = 'ak-step2-spinner';
      if ($text) {
        $text.classList.add('ak-step2-btn-loading');
        $text.insertBefore($spinner, $text.firstChild);
      }

      const stepLinkTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000));
      try {
        await Promise.race([saveAttractionsDB(), stepLinkTimeout]);
        window.location.href = $link.getAttribute('href');
      } catch (err) {
        console.error(err);
        resetStepLink($link);
        alertify.alert(navigator.onLine
          ? "We couldn't save your trip. Please try again in a moment."
          : "You're offline — please check your internet connection and try again.");
      }
    });
  });

  const $cuisineChipWrap = document.querySelector('[data-ak="cuisine-chips"]');
  const $attractionChipWrap = document.querySelector('[data-ak="attraction-chips"]');
  wireChipWrap($cuisineChipWrap, CHIP_CONFIG, chipMarkers, restaurantPreselectPinUrl);
  wireChipWrap($attractionChipWrap, ATTRACTION_CHIP_CONFIG, attractionChipMarkers, cameraPreselectPinUrl);

  // 'idle' fires once after the user stops panning/zooming, but also after things that don't move the
  // viewport at all (e.g. the map container resizing when the popup panel opens/closes) — bail out unless
  // the bounds actually changed, so those no-op idles don't burn a Places API call per active chip.
  let lastIdleBoundsKey = null;
  map.addListener('idle', () => {
    const boundsKeyNow = boundsKey(map.getBounds());
    if (boundsKeyNow === lastIdleBoundsKey) return;
    lastIdleBoundsKey = boundsKeyNow;

    refreshViewportAwareChips($cuisineChipWrap, CHIP_CONFIG, chipMarkers, restaurantPreselectPinUrl);
    refreshViewportAwareChips($attractionChipWrap, ATTRACTION_CHIP_CONFIG, attractionChipMarkers, cameraPreselectPinUrl);
  });

  // Mirrors customize-itinerary.js's .ak-toggle-wrap.transit toggle, adapted to a real checkbox
  // input (checked state drives the layer directly instead of an odd/even click counter).
  // data-ak="toggle-subway" sits on the <label> wrapper in the markup, not the <input> itself.
  const $subwayToggle = document.querySelector('[data-ak="toggle-subway"] input[type="checkbox"]');
  let transitLayer = null;
  $subwayToggle?.addEventListener('change', () => {
    if ($subwayToggle.checked) {
      transitLayer = transitLayer || new google.maps.TransitLayer();
      transitLayer.setMap(map);
    } else {
      transitLayer?.setMap(null);
    }
  });

  document.body.addEventListener('click', handleRemoveLocation);
  document.body.addEventListener('click', handlePopupOpen);
  document.body.addEventListener('click', handleFieldMapPopup);
  document.body.addEventListener('click', handleSectionActivate);
  document.body.addEventListener('click', handleSectionDeactivateOnClickAway);

  document.body.addEventListener('dragstart', handleDragStart);
  document.body.addEventListener('dragover', e => {
    handleDragOver(e);
    expandContentWrapOnDrag(e);
  });
  document.body.addEventListener('drop', handleDrop);
  document.body.addEventListener('dragend', () => { $draggedAttraction = null; });

  document.body.addEventListener('input', e => {
    if (!e.target.matches('.ak-notes')) return;
    setUnsavedChangesFlag();
    clearTimeout(notesSaveTimer);
    notesSaveTimer = setTimeout(() => saveTripNotesLocal(e.target), 500);
  });

  document.body.addEventListener('input', e => {
    const dataAk = e.target.getAttribute?.('data-ak');
    if (!dataAk) return;

    for (const { storageKey, updateKey, prefix, draftKey } of AIRPORT_FIELDS) {
      const field = AIRPORT_FLIGHT_FIELDS.find(({ suffix }) => dataAk === `${prefix}-${suffix}`);
      if (!field) continue;

      setUnsavedChangesFlag();
      clearTimeout(flightFieldSaveTimers[dataAk]);
      flightFieldSaveTimers[dataAk] = setTimeout(() => {
        saveAirportFlightFieldLocal(storageKey, updateKey, draftKey, field.key, e.target.value);
      }, 500);
      return;
    }
  });

  document.body.addEventListener('submit', e => {
    if (e.target.querySelector('.ak-notes, gmp-place-autocomplete')) e.preventDefault();
  });
});


// Main map search autocomplete
async function setupAutocompleteInp() {
  await google.maps.importLibrary('places');

  const placeAutocomplete = new google.maps.places.PlaceAutocompleteElement({
    locationBias: { radius: 5000.0, center: mapCenter },
  });

  placeAutocomplete.placeholder = 'Add an activity...';
  document.querySelector('[data-ak="map-autocomplete"]').appendChild(placeAutocomplete);

  placeAutocomplete.addEventListener('gmp-select', async res => {
    const { placePrediction } = res;
    const place = placePrediction.toPlace();
    await place.fetchFields({ fields: ['id', 'displayName', 'location', 'editorialSummary', 'types', 'formattedAddress', 'addressComponents', 'rating', 'websiteURI', 'nationalPhoneNumber', 'userRatingCount', 'photos', 'regularOpeningHours', 'priceRange', 'businessStatus'] });

    const saveObj = await buildSaveObjFromPlace(place);
    map.panTo(saveObj.location);

    const marker = createMarker(saveObj.displayName, saveObj.location, saveObj.editorialSummary, saveObj.type, cameraPinUrl, saveObj);
    const status = addSearchResultToItinerary(saveObj, marker);
    if (status !== 'added') marker.map = null;

    placeAutocomplete.value = '';
  });
}

// gmp-place-autocomplete computes its internal (closed-shadow-root) click/focus handling at the
// moment it's connected to the document. If that happens while an ancestor is display:none (e.g.
// a hover dropdown that starts hidden), that internal handling never recovers — it renders fine
// once visible but stays permanently unclickable, and there's no way to patch a closed shadow
// root from outside. So never let it connect while hidden: create + connect it inside a tiny
// offscreen-but-genuinely-laid-out holder (NOT display:none, so it initializes correctly), wire
// its listener there, then just MOVE (not recreate) the already-working element into the real
// slot once that slot becomes visible. Reparenting an initialized custom element preserves its
// working internal state.
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

// itinerary_ui_fields_drop grows its own inline height via a Webflow/JS hover
// interaction, and forcing its overflow to visible at placement time (before
// that interaction has run) stops it from ever setting that height — it stays
// collapsed and nothing renders. So don't touch it up front; only relax the
// clip once the widget actually has focus (by then the panel has already
// grown normally), and restore it on blur so the next hover-open cycle is
// undisturbed.
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

function moveWhenVisible($wrap, $el) {
  // The Webflow-authored ancestor chain around these dropdown fields sets
  // pointer-events: none (it's meant as a non-interactive preview box); only
  // the absolutely-positioned .itinerary_ui_fields_drop panel re-enables it.
  // The bare custom element has no Webflow class to pick up an override, so
  // it silently inherits none and swallows nothing — every click passes
  // through it. Re-enable explicitly; a descendant's pointer-events: auto
  // wins over an ancestor's none.
  $wrap.style.pointerEvents = 'auto';
  $el.style.pointerEvents = 'auto';

  const $hiddenAncestor = findHiddenAncestor($wrap);
  if (!$hiddenAncestor) {
    $wrap.appendChild($el);
    return;
  }

  const observer = new ResizeObserver(entries => {
    if (!entries.some(entry => entry.contentRect.width > 0 && entry.contentRect.height > 0)) return;
    observer.disconnect();
    $wrap.appendChild($el);
  });
  observer.observe($hiddenAncestor);
}

function findHiddenAncestor($el) {
  for (let node = $el.parentElement; node; node = node.parentElement) {
    if (getComputedStyle(node).display === 'none') return node;
  }
  return null;
}

async function setupHotelAutocomplete() {
  await google.maps.importLibrary('places');

  const $wrap = document.querySelector('[data-ak="hotel-autocomplete"]');
  if (!$wrap) return;

  const placeAutocomplete = new google.maps.places.PlaceAutocompleteElement({
    componentRestrictions: { country: ['us'] },
    includedRegionCodes: ['us'],
    locationBias: { radius: 5000.0, center: mapCenter },
    includedPrimaryTypes: ['lodging', 'hotel'],
  });
  placeAutocomplete.placeholder = 'Add hotel...';
  placeAutocompleteEls['hotel'] = placeAutocomplete;

  getOffscreenWidgetHolder().appendChild(placeAutocomplete);

  placeAutocomplete.addEventListener('gmp-select', async res => {
    const { placePrediction } = res;
    const place = placePrediction.toPlace();
    await place.fetchFields({ fields: ['id', 'displayName', 'location', 'editorialSummary', 'types', 'formattedAddress', 'rating', 'userRatingCount', 'nationalPhoneNumber', 'regularOpeningHours', 'businessStatus', 'photos', 'websiteURI', 'priceRange'] });

    map.panTo(place.viewport || place.location);

    const placeObj = place.toJSON();
    const { displayName, location: { lat, lng }, editorialSummary, types: type } = placeObj;
    const photoUrl = place.photos?.[0]?.getURI({ maxWidth: 800 }) || '';

    placeAutocomplete.value = '';

    const saveObj = { displayName, location: { lat, lng }, editorialSummary, type, placeId: placeObj.id, address: placeObj.formattedAddress || '', rating: placeObj.rating ?? null, reviewCount: placeObj.userRatingCount ?? null, phone: placeObj.nationalPhoneNumber || '', website: placeObj.websiteURI || placeObj.websiteUri || '', openingHours: placeObj.regularOpeningHours || null, businessStatus: placeObj.businessStatus || null, priceRange: placeObj.priceRange || null, photoUrl };

    const marker = createMarker(displayName, { lat, lng }, editorialSummary, type, hotelMarkerPinUrl, saveObj);
    if (markerObj['hotel']) markerObj['hotel'].setMap(null);
    markerObj['hotel'] = marker;

    const $hotelNameEl = document.querySelector('[data-ak="map-hotel-name"] p');
    if ($hotelNameEl) $hotelNameEl.textContent = displayName;
    showRemoveIcon($hotelNameEl);

    localStorage['ak-hotel'] = JSON.stringify(saveObj);
    localStorage['ak-update-hotel'] = true;
    setUnsavedChangesFlag();
  });

  wireOverflowEscapeOnFocus(placeAutocomplete);
  moveWhenVisible($wrap, placeAutocomplete);
}

async function setupAirportAutocomplete() {
  await google.maps.importLibrary('places');

  AIRPORT_FIELDS.forEach(({ dataAk, markerKey, storageKey, updateKey, nameSelector, placeholder, prefix, draftKey }) => {
    const $wrap = document.querySelector(`[data-ak="${dataAk}"]`);
    if (!$wrap) return;

    initAirportAutocomplete($wrap, markerKey, storageKey, updateKey, nameSelector, placeholder, prefix, draftKey);
  });
}

function initAirportAutocomplete($wrap, markerKey, storageKey, updateKey, nameSelector, placeholder, prefix, draftKey) {
  const placeAutocomplete = new google.maps.places.PlaceAutocompleteElement({
    componentRestrictions: { country: ['us'] },
    includedRegionCodes: ['us'],
    locationBias: { radius: 5000.0, center: mapCenter },
    includedPrimaryTypes: ['airport', 'ferry_terminal', 'international_airport', 'bus_station', 'train_station'],
  });
  if (placeholder) placeAutocomplete.placeholder = placeholder;
  placeAutocompleteEls[markerKey] = placeAutocomplete;

  getOffscreenWidgetHolder().appendChild(placeAutocomplete);

  placeAutocomplete.addEventListener('gmp-select', async res => {
    const { placePrediction } = res;
    const place = placePrediction.toPlace();
    await place.fetchFields({ fields: ['id', 'displayName', 'location', 'editorialSummary', 'types', 'formattedAddress', 'rating', 'userRatingCount', 'nationalPhoneNumber', 'regularOpeningHours', 'businessStatus', 'photos', 'websiteURI'] });

    map.panTo(place.viewport || place.location);

    const placeObj = place.toJSON();
    const { displayName, location: { lat, lng }, editorialSummary, types: type } = placeObj;
    const photoUrl = place.photos?.[0]?.getURI({ maxWidth: 800 }) || '';

    placeAutocomplete.value = '';

    const flightFields = {};
    AIRPORT_FLIGHT_FIELDS.forEach(({ suffix, key }) => {
      flightFields[key] = document.querySelector(`[data-ak="${prefix}-${suffix}"]`)?.value || '';
    });

    const saveObj = { displayName, location: { lat, lng }, editorialSummary, type, placeId: placeObj.id, address: placeObj.formattedAddress || '', rating: placeObj.rating ?? null, reviewCount: placeObj.userRatingCount ?? null, phone: placeObj.nationalPhoneNumber || '', website: placeObj.websiteURI || placeObj.websiteUri || '', openingHours: placeObj.regularOpeningHours || null, businessStatus: placeObj.businessStatus || null, photoUrl, ...flightFields };

    const pin = getCorrectTransportationPinUrl(type);
    const marker = createMarker(displayName, { lat, lng }, editorialSummary, type, pin, saveObj);
    if (markerObj[markerKey]) markerObj[markerKey].setMap(null);
    markerObj[markerKey] = marker;

    const $nameEl = nameSelector ? document.querySelector(nameSelector) : null;
    if ($nameEl) $nameEl.textContent = displayName;
    showRemoveIcon($nameEl);

    localStorage[storageKey] = JSON.stringify(saveObj);
    localStorage[updateKey] = true;
    localStorage.removeItem(draftKey);
    setUnsavedChangesFlag();
  });

  wireOverflowEscapeOnFocus(placeAutocomplete);
  moveWhenVisible($wrap, placeAutocomplete);
}

function getCorrectTransportationPinUrl(type) {
  if (!type) return airportMarkerPinUrl;
  if (type.includes('bus_station')) return busPinUrl;
  if (type.includes('train_station')) return trainPinUrl;
  return airportMarkerPinUrl;
}

function createMarker(title, position, editorialSummary = title, type = [], markerPinSrc = cameraPinUrl, saveObj = null) {
  const markerPinImg = document.createElement('img');
  const isRestaurant = type.includes('restaurant') || type.includes('food');
  markerPinImg.src = isRestaurant ? foodForkPinUrl : markerPinSrc;
  markerPinImg.className = 'ak-marker-pin';

  const marker = new google.maps.marker.AdvancedMarkerElement({
    map,
    position,
    title,
    content: markerPinImg,
    gmpClickable: true,
  });

  marker.addListener('gmp-click', () => {
    openMapPopup(title, editorialSummary, saveObj, marker);
  });

  return marker;
}

function openMapPopup(title, editorialSummary, saveObj, marker = null) {
  const $mapPopup = document.querySelector('[data-ak="map-popup"]');
  if (!$mapPopup) return;

  const $locationBlock = $mapPopup.querySelector('.map_card_content > .map_card_title:first-child');
  if (!$locationBlock) return;

  const $titleEl = $locationBlock.querySelector('.u-size-56-28 h2');
  if ($titleEl) $titleEl.textContent = title || '';
  const $descEl = $locationBlock.querySelector('.u-size-56-28 + .u-size-24-10 p');
  if ($descEl) $descEl.textContent = editorialSummary || title || '';

  const $img = $mapPopup.querySelector('.map_card_img_item');
  const $ratingNum = $locationBlock.querySelector('.map_card_stars_wrap + .u-size-24-10 p em');
  const $reviewCount = $locationBlock.querySelector('.map_card_info .u-hflex-left-center:last-child .u-size-24-10:first-child p');
  const $keyItems = $mapPopup.querySelectorAll('.map_card_key .map_card_key_iem');

  if (saveObj) {
    if ($img) {
      showImageWithSpinner($img, saveObj.photoUrl || noPhotoPlaceholder);
    }

    if ($ratingNum) $ratingNum.textContent = saveObj.rating != null ? saveObj.rating : '';

    if ($reviewCount) {
      $reviewCount.textContent = saveObj.reviewCount != null ? saveObj.reviewCount.toLocaleString() : '0';
    }

    const $address = $keyItems[0]?.querySelector('.u-size-24-10 p');
    const addressVal = saveObj.address || '';
    if ($address) $address.textContent = addressVal;
    if ($keyItems[0]) $keyItems[0].style.display = addressVal ? '' : 'none';

    const $hours = $keyItems[1]?.querySelector('.u-size-24-10 p');
    const hoursVal = getTodayHours(saveObj.openingHours);
    if ($hours) $hours.textContent = hoursVal;
    if ($keyItems[1]) $keyItems[1].style.display = hoursVal ? '' : 'none';

    const $phone = $keyItems[2]?.querySelector('.u-size-24-10 p');
    const phoneVal = saveObj.phone || '';
    if ($phone) $phone.textContent = phoneVal;
    if ($keyItems[2]) $keyItems[2].style.display = phoneVal ? '' : 'none';

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
  }

  const $tipDesc = $mapPopup.querySelector('[data-ak="insider-tip-desc"]');
  const $tipInsiders = $mapPopup.querySelectorAll('[data-ak-insider]');
  const rawEntry = insiderTipsData && saveObj?.placeId ? (insiderTipsData[saveObj.placeId] ?? null) : null;
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

  const $popupActionBtn = $mapPopup.querySelector('.map_card_btn_wrap');
  if ($popupActionBtn) {
    const $existingMatch = findItineraryMatch(saveObj);
    const $actionLabel = $popupActionBtn.querySelector('[data-ak="popup-action-label"]');

    if (!$existingMatch && saveObj?._isSearchResult) {
      if ($actionLabel) $actionLabel.textContent = 'Add Activity';
      $popupActionBtn.onclick = () => {
        const added = addSearchResultToItinerary(saveObj, marker) === 'added';
        if (added) $mapPopup.setAttribute('data-ak-hidden', 'true');
      };
    } else {
      if ($actionLabel) $actionLabel.textContent = 'Remove';
      const $fieldMatch = !$existingMatch ? findMapPopupField(marker) : null;
      $popupActionBtn.onclick = () => {
        alertify.confirm(
          `Remove ${saveObj?.displayName || 'this location'}?`,
          () => {
            if ($existingMatch) removeAttractionLocation($existingMatch);
            else if ($fieldMatch) clearMapPopupField($fieldMatch);
            $mapPopup.setAttribute('data-ak-hidden', 'true');
          },
          () => {}
        );
      };
    }
  }

  $mapPopup.removeAttribute('data-ak-hidden');
  requestAnimationFrame(() => {
    $mapPopup.querySelector('.map_card_-inner')?.scrollTo(0, 0);
  });
}

function findItineraryMatch(saveObj) {
  if (!saveObj) return null;
  const $attractions = $attractionsSlider.querySelectorAll('[data-ak="attraction-location"]:not([data-ak-hidden])');
  return [...$attractions].find(el =>
    (saveObj.placeId && el.placeId === saveObj.placeId) ||
    (saveObj.displayName && el.querySelector('[data-ak="location-title"]')?.textContent.toLowerCase().trim() === saveObj.displayName.toLowerCase().trim())
  ) || null;
}

function findMapPopupField(marker) {
  if (!marker) return null;
  return MAP_POPUP_FIELDS.find(({ markerKey }) => markerObj[markerKey] === marker) || null;
}

// The remove-location icon sits in .ci009_left-icons-wrap, a sibling of the name element inside
// .flex-row — it starts [data-ak-hidden] in the markup since there's nothing to remove
// until a hotel/airport is actually added, and shouldn't reappear for the default placeholder text.
function getRemoveIconWrap($nameEl) {
  return $nameEl?.closest('.flex-row')?.querySelector('.ci009_left-icons-wrap') || null;
}

function showRemoveIcon($nameEl) {
  getRemoveIconWrap($nameEl)?.removeAttribute('data-ak-hidden');
}

function hideRemoveIcon($nameEl) {
  getRemoveIconWrap($nameEl)?.setAttribute('data-ak-hidden', 'true');
}

function clearMapPopupField(field) {
  const marker = markerObj[field.markerKey];
  if (marker) marker.setMap(null);
  delete markerObj[field.markerKey];

  localStorage.removeItem(field.storageKey);
  if (field.updateKey) localStorage[field.updateKey] = true;

  const $nameEl = document.querySelector(field.nameSelector);
  if ($nameEl) $nameEl.textContent = field.defaultText || '';
  hideRemoveIcon($nameEl);

  setUnsavedChangesFlag();
}

function addSearchResultToItinerary(saveObj, marker, { silent = false, slide = null } = {}) {
  const displayName = saveObj.displayName;
  const isRestaurant = (saveObj.type || []).includes('restaurant') || (saveObj.type || []).includes('food');

  const { $currentSlide, slideIndex } = slide || getCurrentSlideInfo();
  const $typeSection = $currentSlide.querySelector(`[data-ak-type="${isRestaurant ? 'eat' : 'visit'}"]`);
  const $typeWrap = $typeSection.querySelector('[data-ak-type-dropzone]');

  if (attractionExists($typeWrap, displayName)) {
    if (!silent) alertify.alert('Sorry, Already Added!');
    return 'duplicate';
  }

  if (!auth.currentUser) {
    if (addedAttractions >= attractionslimit) {
      if (!silent) alertify.alert('Max Limit Reached. Login To Add More');
      return 'limit';
    }
    updateAttractionsCount('+');
    localStorage['ak-update-merge-local'] = true;
  }

  detachFromChipCache(marker);

  markerObj[`slide${slideIndex}`] = markerObj[`slide${slideIndex}`] || [];
  markerObj[`slide${slideIndex}`].push(marker);

  const $content = $typeSection.querySelector('[data-ak-type-panel]');
  if ($content && $content.style.height === '0px') {
    $typeSection.querySelector('[data-ak-type-title]').click();
  }

  addAttractionToList(displayName, $typeWrap, marker, saveObj);
  saveAttractionLocal();

  $currentSlide.querySelector('[data-ak-types].active')?.classList.remove('active');
  $typeSection.classList.add('active');

  if (marker?.content) marker.content.src = isRestaurant ? foodForkPinUrl : cameraPinUrl;

  setUnsavedChangesFlag();
  return 'added';
}

// Bulk import gives us free-text lines instead of an autocomplete prediction, so each line has to be
// resolved to a real place first. Text Search (New) does the search + field-fetch in one call, unlike
// the autocomplete widget flow which needs a separate fetchFields() after a prediction is chosen.
async function resolvePlaceFromText(query) {
  const { places } = await google.maps.places.Place.searchByText({
    textQuery: query,
    fields: ['id', 'displayName', 'location', 'editorialSummary', 'types', 'formattedAddress', 'addressComponents', 'rating', 'websiteURI', 'nationalPhoneNumber', 'userRatingCount', 'photos', 'regularOpeningHours', 'priceRange', 'businessStatus'],
    locationBias: { radius: 5000.0, center: mapCenter },
    maxResultCount: 1,
  });
  return places?.[0] || null;
}

// Mirrors customize-itinerary.js's extractNeighborhood(): prefer the "neighborhood" address
// component Places already gave us, else reverse-geocode the coordinates for it, else fall back
// to the nearest broader area so the ez-guide always has something to show.
async function extractNeighborhood(addressComponents, lat, lng) {
  const find = (...types) => addressComponents.find(c => types.some(t => c.types.includes(t)))?.longText;
  const findLast = (...types) => addressComponents.findLast(c => types.some(t => c.types.includes(t)))?.longText;

  const fromComponents = findLast('neighborhood');
  if (fromComponents) return fromComponents;

  try {
    const geocoder = new google.maps.Geocoder();
    const { results } = await geocoder.geocode({ location: { lat, lng } });
    for (const result of results) {
      if (result.types.includes('neighborhood')) {
        const comp = result.address_components.find(c => c.types.includes('neighborhood'));
        if (comp) return comp.long_name;
      }
    }
  } catch (_) {}

  return find('sublocality', 'sublocality_level_1') || find('locality') || '';
}

async function buildSaveObjFromPlace(place) {
  const placeObj = place.toJSON();
  const { displayName, id, location: { lat, lng }, editorialSummary, types: type = [] } = placeObj;
  const photoUrl = place.photos?.[0]?.getURI({ maxWidth: 800 }) || '';
  const neighborhood = await extractNeighborhood(placeObj.addressComponents || [], lat, lng);

  return {
    location: { lat, lng },
    displayName,
    neighborhood,
    address: placeObj.formattedAddress || '',
    editorialSummary,
    type,
    placeId: id,
    rating: placeObj.rating ?? null,
    website: placeObj.websiteURI || placeObj.websiteUri || '',
    phone: placeObj.nationalPhoneNumber || '',
    reviewCount: placeObj.userRatingCount ?? null,
    photoUrl,
    openingHours: placeObj.regularOpeningHours || null,
    priceRange: placeObj.priceRange || null,
    businessStatus: placeObj.businessStatus || null,
    _isSearchResult: true,
    _detailsLoaded: true,
  };
}

// A day divider is a line made up of one or more characters that are all "not a word or number"
// (letters/digits excluded, everything else — dashes, equals signs, underscores, mixed symbols — allowed).
const DAY_DIVIDER = /^[^a-zA-Z0-9]+$/;

// Splits the bulk-import textarea into one line-array per day: every DAY_DIVIDER line starts a new
// group. Blank lines are dropped, and empty groups (leading/trailing/doubled dividers) are filtered out.
function splitIntoDayGroups(text) {
  const groups = [[]];
  text.split('\n').forEach(rawLine => {
    const line = rawLine.trim();
    if (!line) return;
    if (DAY_DIVIDER.test(line)) {
      groups.push([]);
      return;
    }
    groups[groups.length - 1].push(line);
  });
  return groups.filter(group => group.length);
}

// Bulk import can ask for more days than the trip currently has. When it does, clone the last slide
// (same cloning approach used when a trip is first set up) as a fresh day dated one day later, keeping
// the hidden [data-ak="attraction-location"] template item addAttractionToList() clones from.
function createNextDaySlide() {
  const $slides = [...$attractionsSliderMask.querySelectorAll('.w-slide')];
  const $lastSlide = $slides[$slides.length - 1];

  const daysArr = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthArr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const lastDate = new Date($lastSlide.querySelector('[data-ak="types-date"]').textContent);
  lastDate.setDate(lastDate.getDate() + 1);
  const label = `${monthArr[lastDate.getMonth()]} ${lastDate.getDate()}`;

  const $newSlide = $lastSlide.cloneNode(true);
  $newSlide.setAttribute('aria-hidden', 'true');
  $newSlide.querySelector('[data-ak="types-day"]').textContent = daysArr[lastDate.getDay()];
  $newSlide.querySelector('[data-ak="types-date"]').textContent = `${label}, ${lastDate.getFullYear()}`;

  $newSlide.querySelectorAll('[data-ak-type-dropzone]').forEach($zone => {
    $zone.querySelectorAll('[data-ak="attraction-location"]:not([data-ak-hidden])').forEach($el => $el.remove());
  });
  // The "visit" section starts open by default in the static template slides (no inline height at
  // all) — only eat/notes ship pre-closed — so leave it alone here to match.
  $newSlide.querySelectorAll('[data-ak-type-panel]').forEach($panel => {
    if ($panel.closest('[data-ak-types]')?.getAttribute('data-ak-type') === 'visit') return;
    $panel.style.height = '0px';
  });
  $newSlide.querySelectorAll('[data-ak-types]').forEach($section => $section.classList.remove('active'));
  const $notes = $newSlide.querySelector('.ak-notes');
  if ($notes) $notes.value = '';

  $attractionsSliderMask.append($newSlide);

  return { $currentSlide: $newSlide, slideIndex: $slides.length + 1, label };
}

// Bulk-import textarea: one location per line, days separated by a DAY_DIVIDER line. The first day's
// group lands on the current day; each following group gets its own day, reusing existing day-slides
// where available and creating new ones (dated off the last existing day) once those run out.
async function handleBulkImport() {
  const $textarea = document.querySelector('.itinerary_ui_bulk_text');
  const $finishBtn = document.querySelector('.itinerary_ui_bulk_finish');
  const $bulkWrap = document.querySelector('.itinerary_ui_bulk_wrap');
  if (!$textarea || $finishBtn?.classList.contains('ak-importing')) return;

  const dayGroups = splitIntoDayGroups($textarea.value);
  if (!dayGroups.length) return;

  const $label = $finishBtn?.querySelector('[data-ak="popup-action-label"]');
  const originalLabel = $label?.textContent;

  $finishBtn?.classList.add('ak-importing');
  $finishBtn?.style.setProperty('pointer-events', 'none');
  $finishBtn?.style.setProperty('opacity', '0.6');
  if ($label) $label.textContent = 'Importing...';

  let addedCount = 0;
  const notFound = [];
  const skipped = [];
  const newDayLabels = [];

  outer:
  for (let i = 0; i < dayGroups.length; i++) {
    const slide = i === 0 ? getCurrentSlideInfo() : (() => {
      const created = createNextDaySlide();
      newDayLabels.push(created.label);
      return { $currentSlide: created.$currentSlide, slideIndex: created.slideIndex };
    })();

    for (const line of dayGroups[i]) {
      try {
        const place = await resolvePlaceFromText(line);
        if (!place) { notFound.push(line); continue; }

        const saveObj = await buildSaveObjFromPlace(place);
        const marker = createMarker(saveObj.displayName, saveObj.location, saveObj.editorialSummary, saveObj.type, cameraPinUrl, saveObj);
        const status = addSearchResultToItinerary(saveObj, marker, { silent: true, slide });

        if (status === 'added') {
          addedCount++;
        } else {
          marker.map = null;
          if (status === 'limit') { skipped.push(line); break outer; }
          skipped.push(line);
        }
      } catch (err) {
        console.error(err);
        notFound.push(line);
      }
    }
  }

  if (newDayLabels.length && window.Webflow) {
    Webflow.destroy();
    Webflow.ready();
    Webflow.require('ix2').init();
    Webflow.require('slider').redraw();
  }

  $finishBtn?.classList.remove('ak-importing');
  $finishBtn?.style.removeProperty('pointer-events');
  $finishBtn?.style.removeProperty('opacity');
  if ($label) $label.textContent = originalLabel;

  const failed = [...notFound, ...skipped];
  const summaryParts = [
    addedCount
      ? `Added ${addedCount} location${addedCount === 1 ? '' : 's'}.`
      : `Couldn't add any locations.`,
  ];
  if (newDayLabels.length) summaryParts.push(`Added in\n${newDayLabels.join('\n')}`);
  if (failed.length) summaryParts.push(`Couldn't add: ${failed.join(', ')}.`);
  alertify.alert(summaryParts.join('\n\n'));

  if (addedCount) {
    $textarea.value = '';
    if ($bulkWrap) $bulkWrap.style.display = 'none';
  }
}

function addAttractionToList(name, $listName, marker = null, saveObj = {}) {
  name = format(name);
  const $location = $listName.querySelector('[data-ak="attraction-location"]').cloneNode(true);
  $location.removeAttribute('data-ak-hidden');
  $location.querySelector('[data-ak="location-title"]').textContent = name;
  $location.querySelector('[data-ak="location-link-text"]').textContent = saveObj.neighborhood || name;
  $location.marker = marker;
  $location.saveObj = saveObj;

  const { placeId } = saveObj;
  if (placeId) {
    $location.placeId = placeId;
    const placeIds = JSON.parse(localStorage['ak-place-ids'] || '[]');
    if (!placeIds.includes(placeId)) {
      placeIds.push(placeId);
      localStorage['ak-place-ids'] = JSON.stringify(placeIds);
    }
  }

  $listName.append($location);
}

function getCurrentSlideInfo() {
  const $currentSlide = $attractionsSliderMask.querySelector('.w-slide:not([aria-hidden="true"])');
  const slideIndex = [...$attractionsSliderMask.querySelectorAll('.w-slide')].indexOf($currentSlide) + 1;
  return { $currentSlide, slideIndex };
}

function attractionExists(wrap, name) {
  return [...wrap.querySelectorAll('[data-ak="attraction-location"]:not([data-ak-hidden]) [data-ak="location-title"]')]
    .some(el => el.textContent.toLowerCase().trim() === name.toLowerCase().trim());
}

function handleRemoveLocation(e) {
  if (!e.target.closest('[data-ak="remove-location"]')) return;

  const $attraction = e.target.closest('[data-ak="attraction-location"]');
  if ($attraction && isInAttractionsSlider($attraction)) {
    const name = $attraction.querySelector('[data-ak="location-title"]')?.textContent?.trim() || 'this location';
    alertify.confirm(
      `Remove ${name}?`,
      () => removeAttractionLocation($attraction),
      () => {}
    );
    return;
  }

  // Hotel/airport fields aren't [data-ak="attraction-location"] items — their remove-location link is a
  // sibling of the [data-ak-map-popup] trigger (e.g. [data-ak="map-hotel-name"]) inside .flex-row, not an
  // ancestor, so look sideways for it and match the same way handleFieldMapPopup does off its data-ak.
  const $fieldTrigger = e.target.closest('.flex-row')?.querySelector('[data-ak-map-popup]');
  const triggerName = $fieldTrigger?.getAttribute('data-ak');
  const field = triggerName && MAP_POPUP_FIELDS.find(({ nameSelector }) => nameSelector.startsWith(`[data-ak="${triggerName}"]`));
  if (!field) return;

  const name = document.querySelector(field.nameSelector)?.textContent?.trim() || 'this location';

  alertify.confirm(
    `Remove ${name}?`,
    () => clearMapPopupField(field),
    () => {}
  );
}

function handlePopupOpen(e) {
  if (!e.target.closest('[data-ak="popup-open"]')) return;
  e.preventDefault();

  const $attraction = e.target.closest('[data-ak="attraction-location"]');
  if (!$attraction?.saveObj || !isInAttractionsSlider($attraction)) return;

  map.panTo($attraction.saveObj.location);
  openMapPopup($attraction.saveObj.displayName, $attraction.saveObj.editorialSummary, $attraction.saveObj, $attraction.marker);
  scrollToMapPopupTop();
}

function handleSectionActivate(e) {
  const $title = e.target.closest('[data-ak-type-title]');
  if (!$title || !isInAttractionsSlider($title)) return;

  const $currentSlide = $title.closest('.w-slide');
  $currentSlide.querySelector('[data-ak-types].active')?.classList.remove('active');
  $title.closest('[data-ak-types]').classList.add('active');
}

function handleSectionDeactivateOnClickAway(e) {
  if (isInAttractionsSlider(e.target)) return;
  getCurrentSlideInfo().$currentSlide?.querySelector('[data-ak-types].active')?.classList.remove('active');
}

function handleFieldMapPopup(e) {
  const $trigger = e.target.closest('[data-ak-map-popup]');
  if (!$trigger) return;
  e.preventDefault();

  const triggerName = $trigger.getAttribute('data-ak');
  const field = MAP_POPUP_FIELDS.find(({ nameSelector }) => nameSelector.startsWith(`[data-ak="${triggerName}"]`));
  if (!field) return;

  let saveObj;
  try {
    saveObj = JSON.parse(localStorage[field.storageKey] || 'null');
  } catch (err) {
    saveObj = null;
  }

  if (!saveObj?.location) {
    placeAutocompleteEls[field.markerKey]?.focus();
    return;
  }

  map.panTo(saveObj.location);
  openMapPopup(saveObj.displayName, saveObj.editorialSummary, saveObj, markerObj[field.markerKey]);
  scrollToMapPopupTop();
}

function scrollToMapPopupTop() {
  const $mapPopup = document.querySelector('[data-ak="map-popup"]');
  if (!$mapPopup) return;

  const margin = 20;
  const top = $mapPopup.getBoundingClientRect().top + window.scrollY - margin;
  window.scrollTo({ top, behavior: 'smooth' });
}

function removeAttractionLocation($attraction) {
  if ($attraction.marker) $attraction.marker.setMap(null);

  if ($attraction.placeId) {
    const placeIds = JSON.parse(localStorage['ak-place-ids'] || '[]');
    const idIndex = placeIds.indexOf($attraction.placeId);
    if (idIndex !== -1) placeIds.splice(idIndex, 1);
    localStorage['ak-place-ids'] = JSON.stringify(placeIds);
  }

  const $slide = $attraction.closest('.w-slide');

  $attraction.remove();

  if ($slide) saveAttractionLocal();
  if (!auth.currentUser) updateAttractionsCount('-');
  setUnsavedChangesFlag();
}

let $draggedAttraction = null;

function handleDragStart(e) {
  const $dragEl = e.target.closest('[data-ak="attraction-location"]');
  if (!$dragEl || !isInAttractionsSlider($dragEl)) return;
  $draggedAttraction = $dragEl;
  e.dataTransfer.setData('text/plain', $dragEl.querySelector('[data-ak="location-title"]')?.textContent || '');
  e.dataTransfer.dropEffect = 'move';
}

function handleDragOver(e) {
  const $dropZone = e.target.closest('[data-ak-type-dropzone]');
  if (!$dropZone || !isInAttractionsSlider($dropZone)) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function expandContentWrapOnDrag(e) {
  const $title = e.target.closest('[data-ak-type-title]');
  if (!$title || !isInAttractionsSlider($title)) return;
  const $contentWrap = $title.closest('[data-ak-types]')?.querySelector('[data-ak-type-panel]');
  if (!$contentWrap || $contentWrap.style.height !== '0px') return;
  $title.click();
}

function handleDrop(e) {
  const $dropZone = e.target.closest('[data-ak-type-dropzone]');
  if (!$dropZone || !isInAttractionsSlider($dropZone)) return;
  e.preventDefault();

  if (!$draggedAttraction) return;

  const $fromSlide = $draggedAttraction.closest('.w-slide');

  $dropZone.appendChild($draggedAttraction);
  $draggedAttraction = null;

  const $toSlide = $dropZone.closest('.w-slide');

  if ($fromSlide || $toSlide) saveAttractionLocal();
  setUnsavedChangesFlag();
}

// Single source of truth for per-day Visit/Eat state: reads the same ak-attractions-saved
// snapshot that saveAttractionLocal() writes and saveAttractionsDB() sends to Firestore, so the
// restored UI can never drift from what actually gets saved.
function restoreAttractions() {
  let saved;
  try {
    saved = JSON.parse(localStorage['ak-attractions-saved'] || '{}');
  } catch (e) {
    return;
  }

  const bucketToType = { attractions: 'visit', restaurants: 'eat' };

  $attractionsSliderMask.querySelectorAll('.w-slide').forEach((slide, n) => {
    const slideSaved = saved[`slide${n + 1}`];
    if (!slideSaved) return;

    Object.entries(bucketToType).forEach(([bucket, key]) => {
      const $wrap = slide.querySelector(`[data-ak-type-list="${key}"]`);
      if (!$wrap) return;

      (slideSaved[bucket] || []).forEach(saveObj => {
        const marker = createMarker(saveObj.displayName, saveObj.location, saveObj.editorialSummary, saveObj.type, cameraPinUrl, saveObj);
        addAttractionToList(saveObj.displayName, $wrap, marker, saveObj);
      });
    });
  });
}

function restoreHotel() {
  let saveObj;
  try {
    saveObj = JSON.parse(localStorage['ak-hotel'] || 'null');
  } catch (e) {
    return;
  }
  if (!saveObj?.location) return;

  const { displayName, location, editorialSummary, type } = saveObj;
  const marker = createMarker(displayName, location, editorialSummary, type, hotelMarkerPinUrl, saveObj);
  if (markerObj['hotel']) markerObj['hotel'].setMap(null);
  markerObj['hotel'] = marker;

  const $hotelNameEl = document.querySelector('[data-ak="map-hotel-name"] p');
  if ($hotelNameEl) $hotelNameEl.textContent = displayName;
  showRemoveIcon($hotelNameEl);
}

function restoreAirports() {
  AIRPORT_FIELDS.forEach(({ markerKey, storageKey, nameSelector, prefix, draftKey }) => {
    let saveObj;
    try {
      saveObj = JSON.parse(localStorage[storageKey] || 'null');
    } catch (e) {
      saveObj = null;
    }

    if (!saveObj?.location) {
      restoreAirportFlightDraft(prefix, draftKey);
      return;
    }

    const { displayName, location, editorialSummary, type } = saveObj;
    const pin = getCorrectTransportationPinUrl(type);
    const marker = createMarker(displayName, location, editorialSummary, type, pin, saveObj);
    if (markerObj[markerKey]) markerObj[markerKey].setMap(null);
    markerObj[markerKey] = marker;

    const $nameEl = nameSelector ? document.querySelector(nameSelector) : null;
    if ($nameEl) $nameEl.textContent = displayName;
    showRemoveIcon($nameEl);

    AIRPORT_FLIGHT_FIELDS.forEach(({ suffix, key }) => {
      const $field = document.querySelector(`[data-ak="${prefix}-${suffix}"]`);
      if ($field && saveObj[key]) $field.value = saveObj[key];
    });
  });
}

function restoreAirportFlightDraft(prefix, draftKey) {
  let draft;
  try {
    draft = JSON.parse(localStorage[draftKey] || 'null');
  } catch (e) {
    return;
  }
  if (!draft) return;

  AIRPORT_FLIGHT_FIELDS.forEach(({ suffix, key }) => {
    const $field = document.querySelector(`[data-ak="${prefix}-${suffix}"]`);
    if ($field && draft[key]) $field.value = draft[key];
  });
}

function saveAirportFlightFieldLocal(storageKey, updateKey, draftKey, key, value) {
  let saveObj;
  try {
    saveObj = JSON.parse(localStorage[storageKey] || 'null');
  } catch (e) {
    saveObj = null;
  }

  if (saveObj) {
    saveObj[key] = value;
    localStorage[storageKey] = JSON.stringify(saveObj);
    localStorage[updateKey] = true;
    return;
  }

  let draft;
  try {
    draft = JSON.parse(localStorage[draftKey] || 'null');
  } catch (e) {
    draft = null;
  }
  draft = draft || {};
  draft[key] = value;
  localStorage[draftKey] = JSON.stringify(draft);
}

function saveTripNotesLocal($notes) {
  const slideIndex = [...$attractionsSliderMask.querySelectorAll('.w-slide')].indexOf($notes.closest('.w-slide')) + 1;
  if (!slideIndex) return;

  let saved;
  try {
    saved = JSON.parse(localStorage['ak-trip-notes'] || '{}');
  } catch (e) {
    saved = {};
  }
  saved[`slide${slideIndex}`] = $notes.value;
  localStorage['ak-trip-notes'] = JSON.stringify(saved);
}

function restoreTripNotes() {
  let saved;
  try {
    saved = JSON.parse(localStorage['ak-trip-notes'] || '{}');
  } catch (e) {
    return;
  }

  $attractionsSliderMask.querySelectorAll('.w-slide').forEach((slide, n) => {
    const value = saved[`slide${n + 1}`];
    if (value == null) return;
    const $notes = slide.querySelector('.ak-notes');
    if ($notes) $notes.value = value;
  });
}

// Runs once after restoreAttractions()/restoreTripNotes() have populated the DOM, so a returning
// user immediately sees any day/section that already has content instead of having to click each
// header open manually.
function unwrapSectionsWithContent() {
  $attractionsSliderMask.querySelectorAll('.w-slide').forEach($slide => {
    $slide.querySelectorAll('[data-ak-types]').forEach($typeSection => {
      const type = $typeSection.getAttribute('data-ak-type');
      const hasContent = type === 'notes'
        ? !!$typeSection.querySelector('.ak-notes')?.value.trim()
        : !!$typeSection.querySelector('[data-ak="attraction-location"]:not([data-ak-hidden])');
      if (!hasContent) return;

      const $content = $typeSection.querySelector('[data-ak-type-panel]');
      if ($content?.style.height === '0px') {
        // Goes through Webflow's own click-interaction (rather than setting height directly) so its
        // internal open/closed state for this element stays in sync — setting the DOM ourselves left
        // Webflow's IX2 still thinking the section was closed, so the next real click was a no-op
        // sync-up instead of actually closing it.
        $typeSection.querySelector('[data-ak-type-title]')?.click();
      }
    });
  });
}

// Mirrors setupTravelDates()/setupSliderDates() in customize-itinerary.js: sizes the day slides to
// the user's saved trip length before restoreAttractions() populates them, so slide N exists for
// every day the trip actually spans instead of relying on however many slides the static markup has.
//
// Takes a callback instead of just returning, because when a reinit *is* needed (see below) it replays
// Webflow's own "page load" interactions — including the one that sets every accordion panel back to
// height:0 — so anything that depends on the DOM being in its final settled state (restoreAttractions(),
// unwrapSectionsWithContent(), etc.) has to run after that reinit finishes, not before it.
function restoreTripDaySlides(onSettled) {
  const settle = () => { if (typeof onSettled === 'function') onSettled(); };

  if (!localStorage['ak-travel-days']) return settle();

  let flatpickrDate;
  try {
    ({ flatpickrDate } = JSON.parse(localStorage['ak-travel-days']));
  } catch (e) {
    return settle();
  }
  if (!flatpickrDate) return settle();

  const [startRaw, endRaw] = flatpickrDate.split(/\s+to\s+/);
  const startDate = new Date(startRaw);
  const endDate = new Date(endRaw || startRaw);
  if (isNaN(startDate) || isNaN(endDate)) return settle();

  const msPerDay = 24 * 60 * 60 * 1000;
  const totalDays = Math.round((endDate.getTime() - startDate.getTime()) / msPerDay) + 1;
  if (totalDays < 1) return settle();

  const daysArr = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthArr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const setDayNDate = ($slide, theDate) => {
    const $day = $slide.querySelector('[data-ak="types-day"]');
    const $date = $slide.querySelector('[data-ak="types-date"]');
    if ($day) $day.textContent = daysArr[theDate.getDay()];
    if ($date) $date.textContent = `${monthArr[theDate.getMonth()]} ${theDate.getDate()}, ${theDate.getFullYear()}`;
  };

  const $existingSlides = [...$attractionsSliderMask.querySelectorAll('.w-slide')];
  const $firstSlide = $existingSlides[0];
  if (!$firstSlide) return settle();

  let addedSlide = false;

  for (let i = 0; i < totalDays; i++) {
    const dayDate = new Date(startDate);
    dayDate.setDate(dayDate.getDate() + i);

    // Slide already present (e.g. the static Jan 1/Jan 2 pair Webflow ships with) — just retarget its date.
    if ($existingSlides[i]) {
      setDayNDate($existingSlides[i], dayDate);
      continue;
    }

    // Beyond what's already in the DOM — clone the template slide to cover the remaining days.
    const $newSlide = $firstSlide.cloneNode(true);
    $newSlide.setAttribute('aria-hidden', 'true');
    setDayNDate($newSlide, dayDate);

    $newSlide.querySelectorAll('[data-ak-type-dropzone]').forEach($zone => {
      $zone.querySelectorAll('[data-ak="attraction-location"]:not([data-ak-hidden])').forEach($el => $el.remove());
    });
    // The "visit" section starts open by default in the static template slides (no inline height at
    // all) — only eat/notes ship pre-closed — so leave it alone here to match.
    $newSlide.querySelectorAll('[data-ak-type-panel]').forEach($panel => {
      if ($panel.closest('[data-ak-types]')?.getAttribute('data-ak-type') === 'visit') return;
      $panel.style.height = '0px';
    });
    $newSlide.querySelectorAll('[data-ak-types]').forEach($section => $section.classList.remove('active'));
    const $notes = $newSlide.querySelector('.ak-notes');
    if ($notes) $notes.value = '';

    $attractionsSliderMask.append($newSlide);
    addedSlide = true;
  }

  // Newly appended .w-slide nodes aren't picked up by the Webflow slider widget until it's
  // rebuilt — same reinit handleBulkImport() runs after createNextDaySlide() adds slides.
  // Deferred a frame so the browser has actually laid out the new clones before Webflow
  // measures the container for the redraw — measuring mid-mutation is what let the
  // mask's computed width drift wider as more slides got added in the same tick.
  if (addedSlide && window.Webflow) {
    requestAnimationFrame(() => {
      Webflow.destroy();
      Webflow.ready();
      Webflow.require('ix2').init();
      Webflow.require('slider').redraw();
      settle();
    });
  } else {
    settle();
  }
}

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

  const $dateWrap = document.querySelector('[data-ak="trip-heading-date"]');
  if (!$dateWrap || !localStorage['ak-travel-days']) return;

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

  const $children = $dateWrap.children;
  if ($children.length < 2) return;

  const $firstEm = $children[0].querySelector('p em');
  const $lastEm = $children[$children.length - 1].querySelector('p em');
  if ($firstEm) $firstEm.textContent = fmt(new Date(startRaw));
  if ($lastEm) $lastEm.textContent = fmt(new Date(endRaw || startRaw));
}

function updateAttractionsCount(sign) {
  addedAttractions = sign === '+' ? addedAttractions + 1 : addedAttractions - 1;
  localStorage['ak-addedAttractions-count'] = addedAttractions;
}

function saveAttractionLocal() {
  localStorage['ak-attractions-saved'] = getCurrentUserAttractions();
  localStorage['ak-update-attractions'] = true;
}

function getCurrentUserAttractions() {
  const savedAttractions = {};

  $attractionsSlider.querySelectorAll('.w-slide').forEach((slide, n) => {
    savedAttractions[`slide${n + 1}`] = {};
    const slideObj = savedAttractions[`slide${n + 1}`];

    slide.querySelectorAll('[data-ak-types]').forEach($typeSection => {
      const type = typeKeyMap[$typeSection.getAttribute('data-ak-type')];
      if (!type) return;
      slideObj[type] = [];

      $typeSection.querySelectorAll('[data-ak="attraction-location"]:not([data-ak-hidden])').forEach(attraction => {
        slideObj[type].push(attraction.saveObj);
      });

      if (type === 'notes') {
        const $notes = $typeSection.querySelector('textarea');
        slideObj.dayNotes = $notes ? $notes.value : '';
      }
    });
  });

  return JSON.stringify(savedAttractions);
}

function setUnsavedChangesFlag() {
  $unsavedChanges.removeAttribute('data-ak-hidden');
  localStorage['ak-unsaved-changes'] = true;
}

function removeUnsavedChangesFlag() {
  $unsavedChanges.setAttribute('data-ak-hidden', 'true');
  localStorage.removeItem('ak-unsaved-changes');
}

async function retrieveDBData(userMail) {
  const userRef = doc(db, 'locationsData', `user-${userMail}`);
  const docSnap = await getDoc(userRef);
  return docSnap.exists() ? docSnap.data() : null;
}

// Combines a DB-saved attractions blob with whatever's in ak-attractions-saved, de-duping each
// slide's buckets by displayName (mirrors customize-itinerary.js's mergelocalNDBAttractions, but
// covers every slide instead of just slide1/slide2, since a trip here can run longer than 2 days).
function mergeAttractions(dbSavedAttractionsJSON, localSavedAttractionsJSON) {
  let dbAttractions, localAttractions;
  try { dbAttractions = dbSavedAttractionsJSON ? JSON.parse(dbSavedAttractionsJSON) : {}; } catch (e) { dbAttractions = {}; }
  try { localAttractions = localSavedAttractionsJSON ? JSON.parse(localSavedAttractionsJSON) : {}; } catch (e) { localAttractions = {}; }

  const combineArrays = (dbArr = [], localArr = []) =>
    [...new Map([...dbArr, ...localArr].map(obj => [obj.displayName, obj])).values()];

  const merged = {};
  for (const slide of new Set([...Object.keys(dbAttractions), ...Object.keys(localAttractions)])) {
    const dbSlide = dbAttractions[slide] || {};
    const localSlide = localAttractions[slide] || {};

    merged[slide] = {
      attractions: combineArrays(dbSlide.attractions, localSlide.attractions),
      restaurants: combineArrays(dbSlide.restaurants, localSlide.restaurants),
      notes: combineArrays(dbSlide.notes, localSlide.notes),
    };
    if (localSlide.dayNotes || dbSlide.dayNotes) merged[slide].dayNotes = localSlide.dayNotes || dbSlide.dayNotes || '';
  }

  return JSON.stringify(merged);
}

// Restores whatever this user last saved to Firestore into localStorage, before restoreTripDaySlides()/
// restoreAttractions()/restoreHotel()/restoreAirports()/restoreTripNotes() read those same keys — those
// functions only ever look at localStorage, so without this a fresh login on an empty browser (nothing
// cached locally yet) would show nothing despite the trip already being saved server-side.
//
// Anything the user already touched locally in *this* session (ak-update-hotel/arrival-airport/
// departure-airport, or the ak-update-merge-local flag set when a guest adds attractions pre-login)
// wins over the DB copy instead of being silently overwritten by it.
async function syncWithDB() {
  if (!auth.currentUser) return;

  const userMail = localStorage['ak-referrer-mail'] || localStorage['ak-userMail'];
  if (!userMail) return;

  const dbData = await retrieveDBData(userMail);
  if (!dbData) return;

  // Travel dates and headcounts are never edited on this page (only picked upstream), so a value
  // already sitting in localStorage is always the guest's freshest pick — keep it over the DB copy.
  if (!localStorage['ak-travel-days'] && dbData.travelDates) localStorage['ak-travel-days'] = dbData.travelDates;
  if (!localStorage['ak-user-name'] && dbData.tripName) localStorage['ak-user-name'] = dbData.tripName;
  if (localStorage['ak-adult-num'] == null && dbData.adultNum != null) localStorage['ak-adult-num'] = dbData.adultNum;
  if (localStorage['ak-children-num'] == null && dbData.childrenNum != null) localStorage['ak-children-num'] = dbData.childrenNum;

  if (!localStorage['ak-update-hotel'] && dbData.hotel) localStorage['ak-hotel'] = dbData.hotel;
  if (!localStorage['ak-update-arrival-airport'] && dbData.arrivalAirport) localStorage['ak-arrival-airport'] = dbData.arrivalAirport;
  if (!localStorage['ak-update-departure-airport'] && dbData.departureAirport) localStorage['ak-departure-airport'] = dbData.departureAirport;

  if (dbData.savedAttractions) {
    if (localStorage['ak-update-merge-local']) {
      // Guest added attractions before logging in — combine with what's already saved to the DB
      // instead of either side clobbering the other.
      localStorage['ak-attractions-saved'] = mergeAttractions(dbData.savedAttractions, localStorage['ak-attractions-saved']);
      localStorage.removeItem('ak-update-merge-local');
    } else if (!localStorage['ak-update-attractions']) {
      // No local edits this session — DB is authoritative.
      localStorage['ak-attractions-saved'] = dbData.savedAttractions;
    }
  }
}

async function saveAttractionsDB() {
  if (!localStorage['ak-userMail']) return;
  const userMail = localStorage['ak-referrer-mail'] || localStorage['ak-userMail'];
  const userRef = doc(db, 'locationsData', `user-${userMail}`);

  const saveObj = {
    hotel: localStorage['ak-hotel'] || '',
    arrivalAirport: localStorage['ak-arrival-airport'] || '',
    departureAirport: localStorage['ak-departure-airport'] || '',
    tripName: localStorage['ak-user-name'] || '',
    travelDates: localStorage['ak-travel-days'] || '',
    savedAttractions: getCurrentUserAttractions(),
  };

  saveObj.adultNum = localStorage['ak-adult-num'] ?? null;
  saveObj.childrenNum = localStorage['ak-children-num'] ?? null;
  saveObj.ModifiedAt = serverTimestamp();

  await setDoc(userRef, saveObj, { merge: true });

  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith('ak-update')) continue;
    localStorage.removeItem(key);
  }

  removeUnsavedChangesFlag();
}

function format(str) {
  if (!str) return;
  return str.trim().split(/\s+/).map(capitalize).join(' ');
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
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

function detachFromChipCache(marker) {
  for (const cache of ALL_CHIP_MARKER_CACHES) {
    for (const slug in cache) {
      const arr = cache[slug];
      const idx = arr.indexOf(marker);
      if (idx !== -1) arr.splice(idx, 1);
    }
  }
}

// ===== Cuisine/vibe chips: minimal-data search + lazy popup enrichment =====

const chipRequestSeq = {};
const chipFetchInFlight = new Set();
const chipDebounceTimers = {};
const chipAbortControllers = {};

// Only one chip may be active at a time across both the cuisine and attraction wraps.
let activeChip = null; // { $chip, slug, markerCache }

function deactivateChip() {
  if (!activeChip) return;
  const { $chip, slug, markerCache } = activeChip;
  $chip.removeAttribute('data-ak-active');
  chipAbortControllers[slug]?.abort();
  (markerCache[slug] || []).forEach(marker => marker.setMap(null));
  activeChip = null;
}

// Collapses a burst of calls for the same slug into one: each call resets the timer, so only the
// last call within `delay` ms actually runs fn(). Earlier calls' promises are left pending forever
// (harmless — nothing awaits them past their own caller, which never proceeds).
function debounced(slug, delay, fn) {
  return new Promise(resolve => {
    if (chipDebounceTimers[slug]) clearTimeout(chipDebounceTimers[slug]);
    chipDebounceTimers[slug] = setTimeout(() => {
      delete chipDebounceTimers[slug];
      resolve(fn());
    }, delay);
  });
}

// Cancels any in-flight network request still running for a slug's previous trigger, so a slow
// superseded request stops costing bandwidth instead of just having its result discarded later.
function nextAbortSignal(slug) {
  chipAbortControllers[slug]?.abort();
  const controller = new AbortController();
  chipAbortControllers[slug] = controller;
  return controller.signal;
}

// Briefly flags a chip as errored so Webflow can show a visible failure state instead of a silent
// console-only warning.
function flashChipError($chip) {
  $chip.setAttribute('data-ak-error', 'true');
  setTimeout(() => $chip.removeAttribute('data-ak-error'), 2500);
}

function refreshViewportAwareChips($wrap, configMap, markerCache, pinUrl) {
  $wrap?.querySelectorAll('[data-ak-chip][data-ak-active="true"]').forEach(async $chip => {
    const slug = $chip.getAttribute('data-ak-chip');
    const config = configMap[slug];
    if (!config?.viewportAware) return;
    if (config._curatedResolved) return; // already resolved from the sheet — not viewport-bound, nothing to refresh

    const seq = (chipRequestSeq[slug] = (chipRequestSeq[slug] || 0) + 1);
    const signal = nextAbortSignal(slug);
    $chip.setAttribute('data-ak-loading', 'true');

    try {
      const results = config.debounceMs
        ? await debounced(slug, config.debounceMs, () => config.search(signal))
        : await config.search(signal);

      // A later pan/zoom may have started a fresher request while this one was in flight — drop stale results.
      if (chipRequestSeq[slug] !== seq) return;

      (markerCache[slug] || []).forEach(marker => marker.setMap(null));
      // Same reasoning as the initial activation fetch: don't recreate a dim marker over a spot
      // that's already been added, or the dense marker there gets covered by this fresh dim one.
      markerCache[slug] = results
        .filter(({ saveObj }) => !findItineraryMatch(saveObj))
        .map(({ title, position, saveObj }) => createSearchMarker(title, position, saveObj, pinUrl));
    } catch (e) {
      if (e.name === 'AbortError') return; // superseded by a newer viewport — not a real failure
      console.warn(`Viewport refresh failed for "${slug}":`, e);
      // Leave whatever markers are already on the map from the last successful refresh in place.
      flashChipError($chip);
    } finally {
      if (chipRequestSeq[slug] === seq) $chip.removeAttribute('data-ak-loading');
    }
  });
}

function wireChipWrap($wrap, configMap, markerCache, pinUrl) {
  $wrap?.addEventListener('click', async e => {
    const $chip = e.target.closest('[data-ak-chip]');
    if (!$chip) return;

    const slug = $chip.getAttribute('data-ak-chip');
    const config = configMap[slug];
    if (!config) return;

    if ($chip.getAttribute('data-ak-active') === 'true') {
      deactivateChip();
      return;
    }

    // Activating a new chip always supersedes whatever else was active, in either wrap.
    deactivateChip();
    $chip.setAttribute('data-ak-active', 'true');
    activeChip = { $chip, slug, markerCache };

    if (markerCache[slug]?.length && !config.refetchOnActivate) {
      markerCache[slug].forEach(marker => marker.setMap(map));
      return;
    }

    // Ignore a repeat click while a fetch for this slug is already in flight, rather than firing a
    // second overlapping request that could resolve out of order and overwrite the newer one.
    if (chipFetchInFlight.has(slug)) return;
    chipFetchInFlight.add(slug);

    const signal = nextAbortSignal(slug);
    $chip.setAttribute('data-ak-loading', 'true');

    try {
      const results = await config.search(signal);
      // refetchOnActivate chips drop any stale cache from a previous viewport before showing fresh results.
      (markerCache[slug] || []).forEach(marker => marker.setMap(null));
      // Skip anything already added to the itinerary — otherwise this drops a dim preselect marker
      // directly on top of the already-added dense one, which looks like the dense marker "reverted"
      // once the chip is later deactivated and this fresh dim marker is the one that gets removed.
      markerCache[slug] = results
        .filter(({ saveObj }) => !findItineraryMatch(saveObj))
        .map(({ title, position, saveObj }) => createSearchMarker(title, position, saveObj, pinUrl));
    } catch (e) {
      if (e.name === 'AbortError') return; // superseded — not a real failure, leave UI as the newer trigger left it
      console.warn(`Chip search failed for "${slug}":`, e);
      flashChipError($chip);
      if (markerCache[slug]?.length) {
        // Fall back to the last-good results instead of going blank on a transient failure.
        markerCache[slug].forEach(marker => marker.setMap(map));
      } else {
        $chip.removeAttribute('data-ak-active');
        if (activeChip?.slug === slug) activeChip = null;
      }
    } finally {
      chipFetchInFlight.delete(slug);
      $chip.removeAttribute('data-ak-loading');
    }
  });
}

function createSearchMarker(title, position, saveObj = {}, pinUrl = restaurantPreselectPinUrl) {
  saveObj.location = saveObj.location || position;

  const markerPinImg = document.createElement('img');
  markerPinImg.src = pinUrl;
  markerPinImg.className = 'ak-marker-pin';

  const marker = new google.maps.marker.AdvancedMarkerElement({
    map,
    position,
    title,
    content: markerPinImg,
    gmpClickable: true,
  });

  marker.addListener('gmp-click', async () => {
    if (!saveObj._detailsLoaded) {
      await enrichPlaceDetails(saveObj);
    }
    openMapPopup(saveObj.displayName || title, saveObj.editorialSummary, saveObj, marker);
  });

  return marker;
}

async function enrichPlaceDetails(saveObj) {
  if (!saveObj.placeId) return;
  try {
    const place = new google.maps.places.Place({ id: saveObj.placeId });
    await place.fetchFields({ fields: ['displayName', 'editorialSummary', 'formattedAddress', 'addressComponents', 'rating', 'websiteURI', 'nationalPhoneNumber', 'userRatingCount', 'photos', 'regularOpeningHours', 'priceRange', 'businessStatus'] });
    const placeObj = place.toJSON();

    saveObj.displayName = saveObj.displayName || placeObj.displayName;
    saveObj.neighborhood = saveObj.neighborhood || await extractNeighborhood(placeObj.addressComponents || [], saveObj.location?.lat, saveObj.location?.lng);
    saveObj.editorialSummary = placeObj.editorialSummary;
    saveObj.address = placeObj.formattedAddress || '';
    saveObj.rating = placeObj.rating ?? saveObj.rating ?? null;
    saveObj.website = placeObj.websiteURI || placeObj.websiteUri || '';
    saveObj.phone = placeObj.nationalPhoneNumber || '';
    saveObj.reviewCount = placeObj.userRatingCount ?? saveObj.reviewCount ?? null;
    saveObj.photoUrl = place.photos?.[0]?.getURI({ maxWidth: 800 }) || '';
    saveObj.openingHours = placeObj.regularOpeningHours || null;
    saveObj.priceRange = placeObj.priceRange || null;
    saveObj.businessStatus = placeObj.businessStatus || null;
    saveObj._detailsLoaded = true;
  } catch (e) {
    console.warn('Could not load place details for', saveObj.displayName, e);
  }
}

function getCuratedByTag(tagLabel, expectedType) {
  if (!insiderTipsData) return [];
  const wanted = tagLabel.toLowerCase();
  return Object.entries(insiderTipsData)
    .filter(([, entry]) => entry.tags?.some(t => t.toLowerCase() === wanted))
    .filter(([, entry]) => !expectedType || entry.type === expectedType)
    .map(([placeId, entry]) => ({
      placeId,
      displayName: entry.placeName || '',
      type: entry.type === 'EAT' ? ['restaurant'] : [],
      location: (entry.lat != null && entry.lng != null) ? { lat: entry.lat, lng: entry.lng } : null,
    }));
}

async function resolveCuratedLocation(place) {
  if (place.location) return place.location;
  try {
    const p = new google.maps.places.Place({ id: place.placeId });
    await p.fetchFields({ fields: ['location'] });
    place.location = p.location ? { lat: p.location.lat(), lng: p.location.lng() } : null;
  } catch (e) {
    console.warn('Could not resolve location for', place.displayName, e);
  }
  return place.location;
}

// Rounded to ~11m precision so float jitter between two functionally-identical bounds doesn't
// read as a real viewport change.
function boundsKey(bounds) {
  if (!bounds) return '';
  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  return `${ne.lat().toFixed(4)},${ne.lng().toFixed(4)},${sw.lat().toFixed(4)},${sw.lng().toFixed(4)}`;
}

function boundsToRect(bounds) {
  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  return {
    low: { latitude: sw.lat(), longitude: sw.lng() },
    high: { latitude: ne.lat(), longitude: ne.lng() },
  };
}

function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function textSearchPlaces({ textQuery, includedType, priceLevels, fieldsExtra = [], pageToken, signal }) {
  const fields = ['places.id', 'places.displayName', 'places.location', 'nextPageToken', ...fieldsExtra];
  const payload = {
    textQuery,
    locationRestriction: { rectangle: boundsToRect(map.getBounds()) },
    ...(includedType ? { includedType } : {}),
    ...(priceLevels?.length ? { priceLevels } : {}),
    ...(pageToken ? { pageToken } : {}),
  };

  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': placesApiKey,
      'X-Goog-FieldMask': fields.join(','),
    },
    body: JSON.stringify(payload),
    signal,
  });

  const { places = [], nextPageToken } = await res.json();
  return { places, nextPageToken };
}

async function nearbySearchPlaces({ includedTypes, fieldsExtra = [], signal }) {
  const fields = ['places.id', 'places.displayName', 'places.location', ...fieldsExtra];
  const bounds = map.getBounds();
  const center = bounds.getCenter();
  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  // Nearby Search only accepts a circle (no rectangle like Text Search), so approximate the
  // viewport with a circle of half its diagonal, capped at the API's 50km max radius.
  const radius = Math.min(distanceMeters(sw.lat(), sw.lng(), ne.lat(), ne.lng()) / 2, 50000);

  const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': placesApiKey,
      'X-Goog-FieldMask': fields.join(','),
    },
    body: JSON.stringify({
      includedTypes,
      maxResultCount: 20,
      locationRestriction: { circle: { center: { latitude: center.lat(), longitude: center.lng() }, radius } },
    }),
    signal,
  });

  const { places = [] } = await res.json();
  return places;
}

async function runNearbyTypeChip(config, signal) {
  const needsScore = config.sortBy === 'score';
  const fieldsExtra = (config.minRating || config.minReviewCount || needsScore) ? ['places.rating', 'places.userRatingCount'] : [];
  const places = await nearbySearchPlaces({ includedTypes: config.includedTypes, fieldsExtra, signal });
  const results = places.map(place => toMarkerInput(place, config.markerType || []));
  return applyChipPostProcessing(config, results);
}

function toMarkerInput(place, type = ['restaurant'], extraFields = []) {
  const saveObj = {
    placeId: place.id,
    displayName: place.displayName?.text || '',
    type,
    rating: place.rating ?? null,
    reviewCount: place.userRatingCount ?? null,
    _isSearchResult: true,
  };
  extraFields.forEach(f => {
    const key = f.replace(/^places\./, '');
    saveObj[key] = place[key] ?? null;
  });
  return {
    title: place.displayName?.text || '',
    position: { lat: place.location.latitude, lng: place.location.longitude },
    saveObj,
  };
}

function applyChipPostProcessing(config, results) {
  if (config.bannedWords?.length) {
    results = results.filter(r => {
      const placeName = (r.title || '').toLowerCase();
      return !config.bannedWords.some(word => placeName.includes(word.toLowerCase()));
    });
  }
  if (config.minRating) {
    results = results.filter(r => (r.saveObj.rating ?? 0) >= config.minRating);
  }
  if (config.minReviewCount) {
    results = results.filter(r => (r.saveObj.reviewCount ?? 0) > config.minReviewCount);
  }
  if (config.maxReviewCount) {
    results = results.filter(r => (r.saveObj.reviewCount ?? Infinity) <= config.maxReviewCount);
  }

  if (config.sortBy === 'score') {
    const boostFactor = config.scoreBoostField ? (config.scoreBoostFactor ?? 1.25) : 1;
    const score = r => (r.saveObj.reviewCount || 0) * (r.saveObj.rating || 0) * (config.scoreBoostField && r.saveObj[config.scoreBoostField] ? boostFactor : 1);
    results.sort((a, b) => score(b) - score(a));
  } else if (config.sortBy === 'proximity') {
    const center = map.getCenter();
    const distSq = pos => (pos.lat - center.lat()) ** 2 + (pos.lng - center.lng()) ** 2;
    results.sort((a, b) => distSq(a.position) - distSq(b.position));
  }

  return results.slice(0, config.resultCap ?? 20);
}

async function runTextSearchChip(config, signal) {
  const needsScore = config.sortBy === 'score';
  const fieldsExtra = [
    ...((config.minRating || config.minReviewCount || needsScore) ? ['places.rating', 'places.userRatingCount'] : []),
    ...(config.fetchExtraFields || []),
  ];

  const bounds = map.getBounds();
  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  const viewportSpan = distanceMeters(sw.lat(), sw.lng(), ne.lat(), ne.lng());
  // A viewport this small (corner-to-corner) is unlikely to hold 20+ qualifying places beyond page 1 —
  // skip paying for extra pages regardless of allowPagination when the area itself is this tight.
  const shouldPaginate = config.allowPagination && viewportSpan > 1000;

  let allPlaces = [];
  let pageToken;
  do {
    const page = await textSearchPlaces({ textQuery: config.textQuery, includedType: config.includedType, priceLevels: config.priceLevels, fieldsExtra, pageToken, signal });
    allPlaces = allPlaces.concat(page.places);
    pageToken = page.nextPageToken;
    // Always exhaust pagination (when allowed) before scoring — Text Search ranks page 1 by keyword
    // relevance, not popularity, so the true top-scoring place can land on a later page. Stopping early
    // once we merely had "enough" results risked missing it entirely.
  } while (shouldPaginate && pageToken && allPlaces.length < 60);

  const results = allPlaces.map(place => toMarkerInput(place, config.markerType || ['restaurant'], config.fetchExtraFields));
  return applyChipPostProcessing(config, results);
}

async function runCuratedThenGoogle(config, signal) {
  const entries = getCuratedByTag(config.curatedTag, config.curatedType);
  const [curatedResolved, googleResults] = await Promise.all([
    Promise.all(entries.map(async place => {
      const location = await resolveCuratedLocation(place);
      if (!location) return null;
      return { title: place.displayName, position: location, saveObj: { placeId: place.placeId, displayName: place.displayName, type: place.type, _isSearchResult: true } };
    })),
    runTextSearchChip(config, signal),
  ]);
  const curated = curatedResolved.filter(Boolean);
  const curatedIds = new Set(curated.map(r => r.saveObj.placeId));
  const fresh = googleResults.filter(r => !curatedIds.has(r.saveObj.placeId));
  // Sheet results lead; Google fills in the rest up to the cap.
  return [...curated, ...fresh].slice(0, config.resultCap ?? 20);
}

async function runCuratedOrNearbyFallback(config, signal) {
  const curated = getCuratedByTag(config.curatedTag, config.curatedType);
  if (curated.length) {
    // Mark resolved early — before the async location lookups — so any map-idle that fires
    // during resolution doesn't see a falsy flag and race us to Google.
    config._curatedResolved = true;
    const resolved = await Promise.all(curated.map(async place => {
      const location = await resolveCuratedLocation(place);
      if (!location) return null;
      return { title: place.displayName, position: location, saveObj: { placeId: place.placeId, displayName: place.displayName, type: place.type, _isSearchResult: true } };
    }));
    const valid = resolved.filter(Boolean);
    if (valid.length) return valid;
    // All locations failed to resolve — fall through to nearby search.
    config._curatedResolved = false;
  } else if (insiderTipsData) {
    // Sheet is loaded but genuinely has no entry for this tag — safe to mark false permanently.
    config._curatedResolved = false;
  }
  // insiderTipsData still null: leave _curatedResolved unset so the next call retries the sheet.
  return runNearbyTypeChip(config, signal);
}

async function runCuratedOrFallback(config, signal) {
  const curated = getCuratedByTag(config.curatedTag, config.curatedType);
  if (curated.length) {
    // Mark resolved early — before the async location lookups — so any map-idle that fires
    // during resolution doesn't see a falsy flag and race us to Google.
    config._curatedResolved = true;
    const resolved = await Promise.all(curated.map(async place => {
      const location = await resolveCuratedLocation(place);
      if (!location) return null;
      return { title: place.displayName, position: location, saveObj: { placeId: place.placeId, displayName: place.displayName, type: place.type, _isSearchResult: true } };
    }));
    const valid = resolved.filter(Boolean);
    if (valid.length) return valid;
    // All locations failed to resolve — fall through to text search.
    config._curatedResolved = false;
  } else if (insiderTipsData) {
    // Sheet is loaded but genuinely has no entry for this tag — safe to mark false permanently.
    config._curatedResolved = false;
  }
  // insiderTipsData still null: leave _curatedResolved unset so the next call retries the sheet.
  return runTextSearchChip(config, signal);
}

// All chips share the same live-search logic: viewport-aware refetch on map idle, debounce,
// abort-on-supersede, exhaustive pagination, and a rating/review-count quality gate. Curated chips
// (curatedTag set) keep that same config for their live fallback path — only the sheet lookup
// short-circuits it.
const CHIP_CONFIG = {
  'gluten-free': { curatedTag: 'Gluten Free', curatedType: 'EAT', textQuery: 'restaurant gluten free menu OR gluten free options', includedType: 'restaurant', viewportAware: true, debounceMs: 600, sortBy: 'score', minRating: 4.2, minReviewCount: 50, resultCap: 20, allowPagination: true, search(signal) { return runCuratedOrFallback(this, signal); } },
  'jewish': { curatedTag: 'Jewish', curatedType: 'EAT', textQuery: 'kosher restaurant OR jewish deli OR kosher bakery', includedType: 'restaurant', viewportAware: true, debounceMs: 600, sortBy: 'score', minRating: 4.2, minReviewCount: 50, resultCap: 20, allowPagination: true, search(signal) { return runCuratedOrFallback(this, signal); } },
  'classic-ny': { curatedTag: 'Classic NY', curatedType: 'EAT', textQuery: 'iconic classic new york restaurant', viewportAware: true, debounceMs: 600, sortBy: 'score', minReviewCount: 10000, resultCap: 20, allowPagination: true, search(signal) { return runCuratedOrFallback(this, signal); } },
  'solo-dining': { curatedTag: 'Solo Dining', curatedType: 'EAT', textQuery: 'restaurant cafe bar seating OR eat at the bar OR solo dining OR counter stools', viewportAware: true, debounceMs: 600, sortBy: 'score', minRating: 4.2, minReviewCount: 50, resultCap: 20, allowPagination: true, search(signal) { return runCuratedOrFallback(this, signal); } },
  'big-groups': { curatedTag: 'Big Groups', curatedType: 'EAT', textQuery: 'restaurants good for groups OR large party dining', viewportAware: true, debounceMs: 600, sortBy: 'score', minRating: 4.2, minReviewCount: 50, resultCap: 20, allowPagination: true, search(signal) { return runCuratedOrFallback(this, signal); } },
  'pre-theater': { curatedTag: 'Pre-Theater', curatedType: 'EAT', textQuery: 'pre-theater menu OR prix fixe dinner', viewportAware: true, debounceMs: 600, sortBy: 'score', minRating: 4.2, minReviewCount: 50, resultCap: 20, allowPagination: true, search(signal) { return runCuratedOrFallback(this, signal); } },
  'kid-friendly': { curatedTag: 'Kid Friendly', curatedType: 'EAT', textQuery: 'kid friendly restaurant OR great for kids', viewportAware: true, debounceMs: 600, sortBy: 'score', minRating: 4.2, minReviewCount: 50, resultCap: 20, allowPagination: true, search(signal) { return runCuratedOrFallback(this, signal); } },
  'pizza': { curatedTag: 'Pizza', curatedType: 'EAT', textQuery: 'best pizza slice OR pizzeria', viewportAware: true, debounceMs: 600, sortBy: 'score', minRating: 4.2, minReviewCount: 50, resultCap: 20, allowPagination: true, search(signal) { return runCuratedOrFallback(this, signal); } },
  'italian': { curatedTag: 'Italian', curatedType: 'EAT', textQuery: 'italian restaurant', includedType: 'restaurant', viewportAware: true, debounceMs: 600, sortBy: 'proximity', minRating: 4.2, minReviewCount: 50, resultCap: 20, allowPagination: true, search(signal) { return runCuratedOrFallback(this, signal); } },
  'cheap-eats': { curatedTag: 'Lunch Under 15', curatedType: 'EAT', textQuery: 'cheap eats OR budget restaurant OR street food', priceLevels: ['PRICE_LEVEL_INEXPENSIVE'], viewportAware: true, debounceMs: 600, sortBy: 'score', resultCap: 20, allowPagination: true, search(signal) { return runCuratedOrFallback(this, signal); } },
  'lgbtq': { curatedTag: 'LGBTQ', curatedType: 'EAT', textQuery: 'lgbtq bar OR gay bar OR queer owned restaurant', includedType: 'bar', viewportAware: true, debounceMs: 600, sortBy: 'score', minRating: 4.2, minReviewCount: 50, resultCap: 20, allowPagination: true, search(signal) { return runCuratedOrFallback(this, signal); } },
  'desserts': { curatedTag: 'Desserts', curatedType: 'EAT', textQuery: 'desserts OR cake OR pastry OR sweet shop OR ice cream OR gelateria', fetchExtraFields: ['places.servesDessert'], scoreBoostField: 'servesDessert', viewportAware: true, debounceMs: 600, sortBy: 'score', minRating: 4.2, minReviewCount: 50, resultCap: 20, allowPagination: true, search(signal) { return runCuratedOrFallback(this, signal); } },
  'coffee': { curatedTag: 'Coffee', curatedType: 'EAT', textQuery: 'coffee shop cafe', includedType: 'cafe', viewportAware: true, debounceMs: 600, sortBy: 'score', minRating: 4.3, minReviewCount: 50, resultCap: 20, allowPagination: true, search(signal) { return runCuratedOrFallback(this, signal); } },
  'steak': { curatedTag: 'Steak', curatedType: 'EAT', textQuery: 'steakhouse OR chophouse', includedType: 'restaurant', viewportAware: true, debounceMs: 600, sortBy: 'score', minRating: 4.2, minReviewCount: 50, resultCap: 20, allowPagination: true, search(signal) { return runCuratedOrFallback(this, signal); } },
  'meatless': { curatedTag: 'Meatless', curatedType: 'EAT', textQuery: 'vegan restaurant OR vegetarian options OR plant-based menu', includedType: 'restaurant', viewportAware: true, debounceMs: 600, sortBy: 'score', minRating: 4.2, minReviewCount: 50, resultCap: 20, allowPagination: true, search(signal) { return runCuratedOrFallback(this, signal); } },
  'live-music': { curatedTag: 'Live Music', curatedType: 'EAT', textQuery: 'live music OR jazz club OR live band', includedType: 'bar', viewportAware: true, debounceMs: 600, sortBy: 'score', minRating: 4.2, minReviewCount: 50, resultCap: 20, allowPagination: true, search(signal) { return runCuratedOrFallback(this, signal); } },
};

const ATTRACTION_CHIP_CONFIG = {
  'tours': { curatedTag: 'Tours', curatedType: 'SEE', textQuery: 'guided tours OR walking tours OR sightseeing tours', includedType: 'tourist_attraction', markerType: [], viewportAware: true, debounceMs: 600, sortBy: 'score', minRating: 4.2, minReviewCount: 50, resultCap: 20, allowPagination: true, search(signal) { return runCuratedOrFallback(this, signal); } },
  'kid-friendly': { curatedTag: 'Kid Friendly', curatedType: 'SEE', textQuery: 'kid friendly attractions OR family friendly things to do', includedType: 'tourist_attraction', markerType: [], viewportAware: true, debounceMs: 600, sortBy: 'score', minRating: 4.2, minReviewCount: 50, resultCap: 20, allowPagination: true, search(signal) { return runCuratedThenGoogle(this, signal); } },
  'museums': { curatedTag: 'Museums', curatedType: 'SEE', textQuery: 'museum', includedType: 'museum', markerType: [], viewportAware: true, debounceMs: 600, sortBy: 'score', minRating: 4.2, minReviewCount: 50, resultCap: 20, allowPagination: true, search(signal) { return runCuratedOrFallback(this, signal); } },
  'historic': { curatedTag: 'Historic', curatedType: 'SEE', textQuery: 'historic landmark OR historic site OR historical monument', markerType: [], viewportAware: true, debounceMs: 600, sortBy: 'score', minRating: 4.2, minReviewCount: 50, resultCap: 20, allowPagination: true, search(signal) { return runCuratedOrFallback(this, signal); } },
  'hidden-gems': { curatedTag: 'Hidden Gems', curatedType: 'SEE', includedTypes: ['tourist_attraction', 'museum', 'park', 'historical_place', 'cultural_landmark'], textQuery: 'hidden gem OR unusual attraction OR secret spot OR off the beaten path', minRating: 4.2, markerType: [], viewportAware: true, debounceMs: 600, sortBy: 'score', minReviewCount: 30, maxReviewCount: 1500, resultCap: 20, allowPagination: true, search(signal) { return runCuratedOrFallback(this, signal); } },
  'observation-decks': { curatedTag: 'Observation Decks', curatedType: 'SEE', textQuery: 'observation deck OR rooftop view OR sky deck OR viewpoint', includedType: 'tourist_attraction', markerType: [], viewportAware: true, debounceMs: 600, sortBy: 'score', minRating: 4.2, minReviewCount: 50, resultCap: 20, allowPagination: true, search(signal) { return runCuratedOrFallback(this, signal); } },
  'free': { curatedTag: 'Free', curatedType: 'SEE', textQuery: 'free admission attractions OR free entry things to do', bannedWords: ['pass', 'deck', 'sightseeing', 'card', 'ticket', 'admission fee'], markerType: [], viewportAware: true, debounceMs: 600, sortBy: 'score', minRating: 4.2, minReviewCount: 50, resultCap: 20, allowPagination: true, search(signal) { return runCuratedOrFallback(this, signal); } },
  'retail-stores': { curatedTag: 'Retail Stores', curatedType: 'SEE', textQuery: 'shopping OR retail store', includedType: 'store', markerType: [], viewportAware: true, debounceMs: 600, sortBy: 'score', minRating: 4.2, minReviewCount: 50, resultCap: 20, allowPagination: true, search(signal) { return runCuratedOrFallback(this, signal); } },
  'popular': { curatedTag: 'Popular', curatedType: 'SEE', includedTypes: ['tourist_attraction', 'museum', 'park', 'amusement_center'], markerType: [], viewportAware: true, debounceMs: 600, minRating: 4.0, minReviewCount: 150, sortBy: 'score', resultCap: 20, search(signal) { return runCuratedOrNearbyFallback(this, signal); } },
  'vintage-shopping': { curatedTag: 'Vintage Shopping', curatedType: 'SEE', textQuery: 'vintage shop OR thrift store OR vintage clothing', includedType: 'clothing_store', markerType: [], viewportAware: true, debounceMs: 600, sortBy: 'score', minRating: 4.2, minReviewCount: 50, resultCap: 20, allowPagination: true, search(signal) { return runCuratedOrFallback(this, signal); } },
};
