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

const locationNYC = { lat: 40.7580, lng: -73.9855 };
const cameraPinUrl = 'https://cdn.prod.website-files.com/671ae7755af1656d8b2ea93c/6899df6c29e5f2d2eb42bffc_cam.png';
const foodForkPinUrl = 'https://cdn.prod.website-files.com/671ae7755af1656d8b2ea93c/6899df6ccc71c7d26c3f411c_rest.png';
const restaurantPreselectPinUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADgAAAA4CAMAAACfWMssAAAACXBIWXMAAAAcAAAAHAAPAbmPAAAAulBMVEUAAAAAAAAAAAD///8AAAD////r6+sAAADQ0NBxcXFdXV2UlJT///////8AAAD///////98fHz7+/v///////////////////8AAADMzMz7+/v39/fz8/MZGRnn5+f///////////////+wsLDMzMyIiIj////7wC373Ij///v/67z/99//++/7wDH7xD37yEn7xDn70Gn/++v7zFX756z/45z72Hj/9+v71G3/46T7xDX/78j/89j/89DtKlaHAAAAJnRSTlMATT33DJDYLLRxaIAmTBPjaHXzvDDQx+shsPfz51TQ3zwINJSASBwWgW4AAAMLSURBVHja7f3FovMqFAZQxGP1eu34F6nXK//7v9YlREgoleGd7NEphxVgZ0MYSv+TKNX05kdXVbsfTb1Wele19CoKUdVbb7Byh3TdhP56uZjPF8u1H25IQ6f8gn0TNjtvvUJszzNCv5+wLx04+hfvLi7+EdC/HrlSG8FewCjdB2g/SNNnA9Ot9zC2UzQ+Ra6sIlx5T2IVQhXk6FPFbu49jfkO6t2YpQZ23svYocGt86uNcP4azkO0i7nVMV15b8RqCj3vvhE8y6fvH9K3tA2Qr4QO9sk/dncPOEyjep2dkp97dJgr45g88YRZUZJMxpFO6XJEOTegn/S7gpNhtkfCpMVnQ7YwS5cwQ1H6bHPNkqbLDK0spee0Y4CCXM0YDNLGc5bYKrKeUxTkIbedp2mfLaqxK2GTTW0fd9os45+7HGSFtUFcPrVs3Z63SOZ2jOU1B9nKQ9SSJfpZm7cO8jIUDUgyFi+yibX3QLKk3nIbfI0mhR9Y5qB3SuSVTPyWuusi12OJDwq7yLemcrpkbuMXds4CXQoDcBsqkokLTqTC19z/5wgoVHnoHQKywhV1niDmUCkcclONxowdjgsRXGBI4aiYnDhW/+jqpiK5xIjCSeF1xHEhLiBHKW4CucaEQitfAIkjJRMc6DsVSB8Whb+5kis474EM8UvhX67IM4cD/fMkkhv8UdjLbaso5swlsngAkm3Vo1Drs43MO5E8o6/FG9JmRwc9c1HIViT/5SQ5OuzYSabBet65qI5IkbMn+zDMBGpudjzSw4J/O5HM2sjx6CYzlSTFyA5kcnjcvVUi2Tbew1BSJ1Xs3CfgvozybeQTYFcyKCnW+x8diw1Ihhy//5kb5wYkiXXe/bA6plQIpT5451M+qCtFJ2myO3h9eRi4ssZBqSLXX19X6jJZ4L10Xl2QHJGL5Nh6diWzxmJH1qnItvHoEmjYsqJJj8KUZdeA4NppuLJsSk+iosiy3ecvun1blpWK9DwiKjs/1mQ0VNXhaGL9OPIbLAqNTLgYpia9GVrPVGKjmD2x+g8/BE5ERFWgyAAAAABJRU5ErkJggg==';
const cameraPreselectPinUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADgAAAA4CAMAAACfWMssAAAACXBIWXMAAAAcAAAAHAAPAbmPAAAAwFBMVEUAAAAAAAAFBQUAAAD///////8AAADv7+////9ycnL39/daWlqSkpL///////8AAAD///9+fn7S0tL////////////Ozs4AAAD39/fOzs7r6+v7+/sZGRn///////////+urq7KysqGhob////mUQD/+/vraiXmVgX/8+/3wqbrcjHztpLmWg3vnnLzpn73yq7rgkn74tbzonb77+v77+brdjXzrorvnm778+vvmmrmXhX72sb75trzuprmWgnvilYWhbgFAAAAI3RSTlMATT4MypIs3vdy62aBJUwTZna2MO+9riHzss73VDwINJaCSJLJ42QAAALmSURBVHja7f3VgqtKEEUB0DgSj49P4UA8npn5/786DcEC3YT7dl92RpNalLY8Mv8TtbrCSJ3K8lQdCd1WU2ogqPAgVRg0wNo8Nt26x5V1se2LtTq6W/wG336CfWDs5O+NB+39E0Y/arB3AWAX/hoV/YY7AOGdxrV4MA+BQVRwMIGnlOltCDfPoMq7wfCNxLVlWAZGjYIlyIQavcnwYzzRD8gVn63hcy4ih6U833lYGg20BP6xtgLcgiZgcAOhyH2A6RmN5JlQnAQeDmWDRaLSFBkH4HOuDbtSoJ6TTrhTIoMdtAsOwxK3zdeGU0oizF0O4JTO56+/c7DM4qoyo3d2fmZygkFWUj993A9QlbXZzwqrQpaHQwed1GYP6p1rwTZLAGqUGW3hPj5dcIngerlcE0EXukmKRwLoWtH/lksAj0mSI1hVQPMP/2Pb+MefWQFXMEpqY1XADf74CnDFj9xUQCupzhQuZXBtG+f7X2fDXpfBC0xj0AS7DIaGlURoWpnLzMgGMwblKrjPA9zgvlVAmRaqhccjkY9TooRKKI5nLFJwYXhlMC3OvNqOc2aNn3EugyuYx2C/OgBXI40Vj/+1DB6hH4NfhJHD/d/ggXdwP/+gDLrwFYPfhCGP1r3tebjce6cCbuE7BieFZZUagbmJe2Rv8jWd2uBlNYlBbpwvZMjluIuFW1yfqY0PY+6+IJV864AaJSZ461DuHCPmm9Wazq0TE7xZiQnI6dn2uDJpnJk0G2+PehIpw7BStiFb4YKoMJ2uA0hsyjEd5b8cAUonAxl21vzQmeUOsctXqekxJ70WHOLCak0PVk1kHsT2Xpoc5S899pFjOKS/PL88vOiIK4FMB/WeX1d6CCdYJTWp/oIkaSQuIl9ndVey2SuZw3mySJFol0BJQSzH0CQipJOvnTpCIlOjDouQMi5fdMcKQmyHqVeEIu2zP79fref9Tw01wCJxOOBHiRzTUNxEZCPPiGXFCZn6BwWINKzKLT0vAAAAAElFTkSuQmCC';
const insiderTipsUrl = 'https://us-central1-askkhonsu-map.cloudfunctions.net/getInsiderTips';
const placesApiKey = 'AIzaSyCMmi6kGAOGfMzK4CBvNiVBB7T6OjGbsU4';
const noPhotoPlaceholder = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400"><rect width="800" height="400" fill="#ece9e4"/><circle cx="400" cy="185" r="60" fill="none" stroke="#aaa" stroke-width="3"/><g transform="translate(380,165) scale(1.667)"><path d="M12 15.2c1.77 0 3.2-1.43 3.2-3.2S13.77 8.8 12 8.8 8.8 10.23 8.8 12s1.43 3.2 3.2 3.2zM9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" fill="#bbb"/></g></svg>')}`;

const locations = {
  new_york: { lat: 40.7580, lng: -73.9855 },
  washington_dc: { lat: 38.89511, lng: -77.03637 },
  los_angeles: { lat: 34.052235, lng: -118.243683 },
  las_vegas: { lat: 36.175, lng: -115.136 },
  miami: { lat: 25.7743, lng: -80.1937 },
};

const timeslotKeyMap = { morning: 'attractions', afternoon: 'restaurants', evening: 'notes' };
const attractionslimit = 5;

const $attractionsSlider = document.querySelector('[data-ak="locations-slider"]');
const $attractionsSliderMask = $attractionsSlider.querySelector('.w-slider-mask');
const $unsavedChanges = document.querySelector('[data-ak="slider-locations-changes"]');

let map;
let infoWindow;
let insiderTipsData = null;
let addedAttractions = 0;
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

initMap(mapCenter);
async function initMap(center) {
  const $map = document.querySelector('[data-ak="map"]');
  const { Map, InfoWindow } = await google.maps.importLibrary('maps');
  await google.maps.importLibrary('marker');
  await google.maps.importLibrary('places');
  map = new Map($map, {
    zoom: 12,
    center,
    mapId: 'd604d19d3ee253cb9ac6f7f8',
    mapTypeControl: false,
  });
  infoWindow = new InfoWindow();
  return map;
}


window.addEventListener('load', async () => {
  document.querySelector('[data-ak="map-popup"]')?.querySelector('.map-popup-close')?.addEventListener('click', () => {
    document.querySelector('[data-ak="map-popup"]')?.setAttribute('data-ak-hidden', 'true');
  });

  loadInsiderTips();

  await new Promise(resolve => onAuthStateChanged(auth, resolve));

  if (auth.currentUser) localStorage.removeItem('ak-addedAttractions-count');
  addedAttractions = Number(localStorage['ak-addedAttractions-count'] || 0);

  const $cuisineChipWrap = document.querySelector('[data-ak="cuisine-chips"]');
  const $attractionChipWrap = document.querySelector('[data-ak="attraction-chips"]');
  wireChipWrap($cuisineChipWrap, CHIP_CONFIG, chipMarkers, restaurantPreselectPinUrl);
  wireChipWrap($attractionChipWrap, ATTRACTION_CHIP_CONFIG, attractionChipMarkers, cameraPreselectPinUrl);

  // 'idle' fires once after the user stops panning/zooming (not on every drag frame) — refetch any
  // active chip whose results are tied to the current viewport.
  map.addListener('idle', () => {
    refreshViewportAwareChips($cuisineChipWrap, CHIP_CONFIG, chipMarkers, restaurantPreselectPinUrl);
    refreshViewportAwareChips($attractionChipWrap, ATTRACTION_CHIP_CONFIG, attractionChipMarkers, cameraPreselectPinUrl);
  });
});


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
        const added = addSearchResultToItinerary(saveObj, marker);
        if (added) $mapPopup.setAttribute('data-ak-hidden', 'true');
      };
    } else {
      if ($actionLabel) $actionLabel.textContent = 'Remove';
      $popupActionBtn.onclick = () => {
        alertify.confirm(
          `Remove ${saveObj?.displayName || 'this location'}?`,
          () => {
            $existingMatch?.querySelector('[data-ak="remove-location"]')?.click();
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
  const $attractions = document.querySelectorAll('[data-ak="attraction-location"]:not(.hidden)');
  return [...$attractions].find(el =>
    (saveObj.placeId && el.placeId === saveObj.placeId) ||
    (saveObj.displayName && el.querySelector('[data-ak="location-title"]')?.textContent.toLowerCase().trim() === saveObj.displayName.toLowerCase().trim())
  ) || null;
}

function addSearchResultToItinerary(saveObj, marker) {
  const displayName = saveObj.displayName;
  const isRestaurant = (saveObj.type || []).includes('restaurant') || (saveObj.type || []).includes('food');

  const { $currentSlide, slideIndex } = getCurrentSlideInfo();
  const $timeslot = $currentSlide.querySelector(`[data-ak-timeslot="${isRestaurant ? 'afternoon' : 'morning'}"]`);
  const $timeslotWrap = $timeslot.querySelector('[data-ak-timeslot-wrap]');

  if (attractionExists($timeslotWrap, displayName)) {
    alert('Sorry, Already Added!');
    return false;
  }

  if (!auth.currentUser) {
    if (addedAttractions >= attractionslimit) {
      alert('Max Limit Reached. Login To Add More');
      return false;
    }
    updateAttractionsCount('+');
    localStorage['ak-update-merge-local'] = true;
  }

  detachFromChipCache(marker);

  markerObj[`slide${slideIndex}`] = markerObj[`slide${slideIndex}`] || [];
  markerObj[`slide${slideIndex}`].push(marker);

  if ($timeslot.querySelector('[data-ak-timeslot-content]').style.height === '0px') {
    $timeslot.querySelector('[data-ak-timeslot-title]').click();
  }

  addAttractionToList(displayName, $timeslotWrap, marker, saveObj);
  saveAttractionLocal();

  $currentSlide.querySelector('[data-ak-timeslots].active')?.classList.remove('active');
  $timeslot.classList.add('active');

  if (marker?.content) marker.content.src = isRestaurant ? foodForkPinUrl : cameraPinUrl;

  setUnsavedChangesFlag();
  return true;
}

function addAttractionToList(name, $listName, marker = null, saveObj = {}) {
  name = format(name);
  const $location = $listName.querySelector('[data-ak="attraction-location"]').cloneNode(true);
  $location.classList.remove('hidden');
  $location.querySelector('[data-ak="location-title"]').textContent = name;
  $location.querySelector('[data-ak="location-link-text"]').textContent = name;
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
  const $currentSlide = document.querySelector('.w-slide:not([aria-hidden="true"])');
  const slideIndex = [...$attractionsSliderMask.querySelectorAll('.w-slide')].indexOf($currentSlide) + 1;
  return { $currentSlide, slideIndex };
}

function attractionExists(wrap, name) {
  return [...wrap.querySelectorAll('[data-ak="attraction-location"]:not(.hidden) [data-ak="location-title"]')]
    .some(el => el.textContent.toLowerCase().trim() === name.toLowerCase().trim());
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

    slide.querySelectorAll('[data-ak-timeslots] [data-ak-timeslot-content]').forEach(timeslotContent => {
      const timeslot = timeslotKeyMap[timeslotContent.querySelector('[data-ak-timeslot-wrap]').getAttribute('data-ak-timeslot-wrap')];
      slideObj[timeslot] = [];

      timeslotContent.querySelectorAll('[data-ak="attraction-location"]:not(.hidden)').forEach(attraction => {
        slideObj[timeslot].push(attraction.saveObj);
      });

      if (timeslot === 'notes') {
        const $notes = timeslotContent.querySelector('textarea');
        slideObj.dayNotes = $notes ? $notes.value : '';
      }
    });
  });

  return JSON.stringify(savedAttractions);
}

function setUnsavedChangesFlag() {
  $unsavedChanges.classList.remove('hide');
  localStorage['ak-unsaved-changes'] = true;
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
      markerCache[slug] = results.map(({ title, position, saveObj }) =>
        createSearchMarker(title, position, saveObj, pinUrl));
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
      markerCache[slug] = results.map(({ title, position, saveObj }) =>
        createSearchMarker(title, position, saveObj, pinUrl));
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
    await place.fetchFields({ fields: ['displayName', 'editorialSummary', 'formattedAddress', 'rating', 'websiteURI', 'nationalPhoneNumber', 'userRatingCount', 'photos', 'regularOpeningHours', 'priceRange', 'businessStatus'] });
    const placeObj = place.toJSON();

    saveObj.displayName = saveObj.displayName || placeObj.displayName;
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
