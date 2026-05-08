import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc,
    updateDoc, deleteField,
    arrayUnion, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
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
const db   = getFirestore(app);

let map;
let infoWindow;

const locationNYC = { lat: 40.7580, lng: -73.9855 };
const markerPinUrl = 'https://cdn.prod.website-files.com/671ae7755af1656d8b2ea93c/677cc99549bcbb38edad633e_pin24.png';
const hotelMarkerPinUrl = 'https://cdn.prod.website-files.com/671ae7755af1656d8b2ea93c/68879b831dec5947617d34e3__hotel.png';
const airportMarkerPinUrl = 'https://cdn.prod.website-files.com/671ae7755af1656d8b2ea93c/68879bb7f77423763223d449__airport.png';
const cameraPinUrl = 'https://cdn.prod.website-files.com/671ae7755af1656d8b2ea93c/6899df6c29e5f2d2eb42bffc_cam.png';
const foodForkPinUrl = 'https://cdn.prod.website-files.com/671ae7755af1656d8b2ea93c/6899df6ccc71c7d26c3f411c_rest.png';
const busPinUrl = 'https://cdn.prod.website-files.com/68935fa3de135948255cdf3b/68b9c734dec75c736ea75eaa_bus.png';
const trainPinUrl = 'https://cdn.prod.website-files.com/68935fa3de135948255cdf3b/68b9c7346b2a3e350322617a_train.png';
const directionsUrlBase = 'https://www.google.com/maps/search/';
const firebaseUrl = 'https://getspreadsheetdata-qqhcjhxuda-uc.a.run.app';

const $tripTitleInfo = document.querySelector('.ak-trip-info');
const $tripTitle = $tripTitleInfo.querySelector('[data-ak="trip-title"]');
const $attractionsSlider = document.querySelector('[data-ak="locations-slider"]');
const $attractionsSliderMask = $attractionsSlider.querySelector('.w-slider-mask');
const $saveItineraryBtn = document.querySelector('[data-ak="save-itinerary"]');
const $unsavedChanges = document.querySelector('[data-ak="slider-locations-changes"]');
const $mapPinsRadios = document.querySelectorAll('.ak-map-pins-wrap input[type=radio]');
const $sliderArrows = document.querySelectorAll('.w-slider-arrow-left, .w-slider-arrow-right');
const currentPage = window.location.pathname || '/customize-itinerary';
const nonCountDays = 2;
const attractionslimit = 5;

let addedAttractions = 0;
const markerObj = {};

const locations = {
  new_york: { lat: 40.7580, lng: -73.9855 },
  washington_dc: { lat: 38.89511, lng: -77.03637 },
  los_angeles: { lat: 34.052235, lng: -118.243683 },
  las_vegas: { lat: 36.175, lng: -115.136 },
  miami: { lat: 25.7743, lng: -80.1937 },
};

let mapCenter = locationNYC;
if (localStorage['ak-user-destination']) {
  mapCenter = locations[localStorage['ak-user-destination']];
}

initMap(mapCenter);
async function initMap(center) {
  const $map = document.querySelector('.map');
  const { Map, InfoWindow } = await google.maps.importLibrary('maps');
  await google.maps.importLibrary('marker');
  await google.maps.importLibrary('places');
  map = new google.maps.Map($map, {
    zoom: 12,
    center,
    mapId: 'DEMO_MAP_ID',
    mapTypeControl: false,
  });
  infoWindow = new InfoWindow();
  return map;
}


window.addEventListener('load', async () => {

  await new Promise(resolve => onAuthStateChanged(auth, resolve));

  // Bridge: keep ak-userMail consistent so the rest of the code works unchanged
  if (auth.currentUser) localStorage['ak-userMail'] = auth.currentUser.email;

  if (auth.currentUser) localStorage.removeItem('ak-addedAttractions-count');
  addedAttractions = Number(localStorage['ak-addedAttractions-count'] || 0);

  const attractionMarkers = [];

  const $toggleAttractionsWrap = document.querySelector('.ak-toggle-wrap.attractions');
  $toggleAttractionsWrap?.addEventListener('click', async e => {
    if (!e.target.classList.contains('ak-toggle')) return;
    if (!e.target.classList.contains('attractions')) return;

    e.target.n = (e.target.n || 0) + 1;
    if (e.target.n % 2 === 0) {
      clearMarkers(attractionMarkers);
    } else if (attractionMarkers.length > 0) {
      attractionMarkers.forEach(marker => marker.setMap(map));
    } else {
      addNewPlacesLayer(['tourist_attraction'], attractionMarkers);
    }
  });

  function clearMarkers(markerArray) {
    markerArray.forEach(marker => marker.setMap(null));
  }

  async function addNewPlacesLayer(type, markerArray) {
    const center = map.getBounds().getCenter();
    searchForNearbyPlaces(center.lat(), center.lng(), type, markerArray);
  }

  async function searchForNearbyPlaces(latitude, longitude, includedTypes = ['restaurant'], markerArray, radius = 500.0) {
    const nearbySearchUrl = 'https://places.googleapis.com/v1/places:searchNearby';
    const key = 'AIzaSyCMmi6kGAOGfMzK4CBvNiVBB7T6OjGbsU4';
    const payload = {
      includedTypes,
      locationRestriction: {
        circle: { center: { latitude, longitude }, radius }
      }
    };

    const res = await fetch(nearbySearchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'places.location,places.displayName,places.editorialSummary',
      },
      body: JSON.stringify(payload),
    });

    const { places } = await res.json();
    places.forEach(place => {
      const { displayName: { text: title }, location: { latitude: lat, longitude: lng }, editorialSummary } = place;
      const position = { lat, lng };
      const desc = editorialSummary ? editorialSummary.text : title;
      const marker = createMarker(title, position, desc);
      map.setCenter(position);
      map.setZoom(15);
      markerArray.push(marker);
    });
  }


  const $toggleTransitWrap = document.querySelector('.ak-toggle-wrap.transit');
  $toggleTransitWrap?.addEventListener('click', async e => {
    if (!e.target.classList.contains('ak-toggle')) return;
    if (!e.target.classList.contains('transit')) return;
    $toggleTransitWrap.n = ($toggleTransitWrap.n || 0) + 1;

    if ($toggleTransitWrap.n % 2 === 0) {
      await initMap(mapCenter);
    } else {
      const map = await initMap(mapCenter);
      new google.maps.TransitLayer().setMap(map);
    }

    const checkedVal = document.querySelector('[name="View-Map-Pins"]:checked')?.value;
    showHidePins(checkedVal);
  });


  updateSavedChangesFlag();
  hideShowLoginNSavebtn();

  function updateSavedChangesFlag() {
    if (localStorage['ak-unsaved-changes']) setUnsavedChangesFlag();
  }

  function hideShowLoginNSavebtn() {
    const $preLoginBtns = document.querySelectorAll('[data-ak-pre-login]');
    const $postLoginBtns = document.querySelectorAll('[data-ak-post-login]');

    if (auth.currentUser) {
      $postLoginBtns.forEach(btn => btn.removeAttribute('data-ak-hidden'));

      // $printItineraryBtn.removeAttribute('data-ak-hidden');
      // $printItineraryBtn.addEventListener('click', () => {
      //   const userMail = localStorage['ak-userMail'];
      //   const userId = userMail ? encodeURIComponent(userMail) : '';
      //   window.location.href = `/itinerary-list?id=${userId}`;
      // });
    } 
    else {
      $preLoginBtns.forEach(btn => processLogin(btn));
    }

    function processLogin($btn) {
      $btn.classList.remove('hidden');
      $btn.removeAttribute('data-ak-hidden');
      $btn.addEventListener('click', () => {
        if (!auth.currentUser) window.location.href = '/firebase-claude-auth-login';
      });
    }
  }


  if (auth.currentUser) {
    const userMail = localStorage['ak-userMail'];
    const data = await retrieveDBData(userMail);

    if (!data) {
      handleUserNotSavedInDB();
      createUserInFirebase(userMail);

      const savedAttractions = localStorage['ak-attractions-saved'];
      const tripName = auth.currentUser?.displayName?.split(' ')[0] || auth.currentUser?.email?.split('@')[0] || '';
      const travelDates = localStorage['ak-travel-days'];
      const hotel = localStorage['ak-hotel'];
      const arrivalAirport = localStorage['ak-arrival-airport'];
      const departureAirport = localStorage['ak-departure-airport'];

      setupUserInfo(savedAttractions, tripName, travelDates, hotel, arrivalAirport, departureAirport);
      await saveAttractionsDB();
      removeUnsavedChangesFlag();

      function handleUserNotSavedInDB() {
        if (!localStorage['ak-update-travel-days']) {
          localStorage.removeItem('ak-travel-days');
        }

        if (localStorage['ak-referred']) {
          localStorage.removeItem('ak-referred');
          showErrorAlertNRedirect(userMail);
          return;
        }

        showTripInfoHeader();
      }
    } else {
      const { referrerMail } = data;

      if (referrerMail) {
        if (localStorage['ak-update-merge-local']) localStorage['ak-update-merge-db'] = true;
        localStorage['ak-referrer-mail'] = referrerMail;

        const referrerData = await retrieveDBData(referrerMail);
        const { tripName, travelDates, hotel, arrivalAirport, departureAirport, savedAttractions } = referrerData;

        const { userTravelDates, userHotel, userArrivalAirport, userDepartureAirport, userAttractions } =
          processSetupInfoData(travelDates, hotel, arrivalAirport, departureAirport, savedAttractions);

        localStorage['ak-hotel'] = userHotel;
        localStorage['ak-arrival-airport'] = userArrivalAirport;
        localStorage['ak-departure-airport'] = userDepartureAirport;

        setupUserInfo(userAttractions, tripName, userTravelDates, userHotel, userArrivalAirport, userDepartureAirport);
        localStorage.removeItem('ak-referred');

        handleSeverTiesToReferrer();
      } else {
        if (localStorage['ak-referred']) {
          const name = localStorage['ak-user-name']?.split(/\s+/)[0] || '';
          alert(`${name ? `Hi ${name}\n` : ''}The email address: ${userMail}\nis not connected to another plan\nHere's your current plan`);
          localStorage.removeItem('ak-referred');
        }

        if (localStorage['ak-update-merge-local']) localStorage['ak-update-merge-db'] = true;

        const { tripName, travelDates, hotel, arrivalAirport, departureAirport, savedAttractions } = data;
        const userName = auth.currentUser?.displayName?.split(' ')[0] || auth.currentUser?.email?.split('@')[0] || '';
        const userTripName = tripName || userName;

        const { userTravelDates, userHotel, userArrivalAirport, userDepartureAirport, userAttractions } =
          processSetupInfoData(travelDates, hotel, arrivalAirport, departureAirport, savedAttractions);

        localStorage['ak-hotel'] = userHotel;
        localStorage['ak-arrival-airport'] = userArrivalAirport;
        localStorage['ak-departure-airport'] = userDepartureAirport;

        setupUserInfo(userAttractions, userTripName, userTravelDates, userHotel, userArrivalAirport, userDepartureAirport);
      }
    }
  } else if (localStorage['ak-attractions-saved']) {
    const savedAttractions = localStorage['ak-attractions-saved'];
    const travelDates = localStorage['ak-travel-days'];
    const hotel = localStorage['ak-hotel'];
    const arrivalAirport = localStorage['ak-arrival-airport'];
    const departureAirport = localStorage['ak-departure-airport'];

    setupUserInfo(savedAttractions, undefined, travelDates, hotel, arrivalAirport, departureAirport);
    localStorage['ak-update-merge-local'] = true;
  } 
  else {
    setupUserInfo(undefined, 
                  undefined, 
                  localStorage['ak-travel-days'], 
                  localStorage['ak-hotel'], 
                  localStorage['ak-arrival-airport'], 
                  localStorage['ak-departure-airport']);
    
    showTripInfoHeader();
  }


  function processSetupInfoData(travelDates, hotel, arrivalAirport, departureAirport, savedAttractions) {
    const userTravelDates = localStorage['ak-update-travel-days'] ? localStorage['ak-travel-days'] : travelDates;
    const userHotel = localStorage['ak-update-hotel'] ? localStorage['ak-hotel'] : hotel;
    const userArrivalAirport = localStorage['ak-update-arrival-airport'] ? localStorage['ak-arrival-airport'] : arrivalAirport;
    const userDepartureAirport = localStorage['ak-update-departure-airport'] ? localStorage['ak-departure-airport'] : departureAirport;

    let userAttractions;
    if (localStorage['ak-update-attractions']) {
      if (localStorage['ak-update-merge-local'] && localStorage['ak-update-merge-db']) {
        mergelocalNDBAttractions(savedAttractions);
      }
      userAttractions = localStorage['ak-attractions-saved'];
    } else {
      userAttractions = savedAttractions;
    }

    return { userTravelDates, userHotel, userArrivalAirport, userDepartureAirport, userAttractions };
  }

  function mergelocalNDBAttractions(savedAttractionsDB) {
    const localSavedAttractions = JSON.parse(localStorage['ak-attractions-saved']);
    const savedAttractions = JSON.parse(savedAttractionsDB);

    for (const [slide, attractions] of Object.entries(savedAttractions)) {
      if (slide !== 'slide1' && slide !== 'slide2') continue;

      const { morning: savedMorningArr, afternoon: savedAfternoonArr, evening: savedEveningArr } = attractions;
      const { morning: localMorningArr, afternoon: localAfternoonArr, evening: localEveningArr } = localSavedAttractions[slide];

      savedAttractions[slide].morning = combineArrays(savedMorningArr, localMorningArr);
      savedAttractions[slide].afternoon = combineArrays(savedAfternoonArr, localAfternoonArr);
      savedAttractions[slide].evening = combineArrays(savedEveningArr, localEveningArr);
    }

    localStorage['ak-attractions-saved'] = JSON.stringify(savedAttractions);
    localStorage.removeItem('ak-update-merge-local');
    localStorage.removeItem('ak-update-merge-db');

    function combineArrays(savedArr, localArr) {
      return [...new Map([...savedArr, ...localArr].map(obj => [obj.displayName, obj])).values()];
    }
  }

  const $secondaryEmailWrap = document.querySelector('[data-ak="add-secondary-email-section"]');
  if (auth.currentUser && !localStorage['ak-referrer-mail']) {
    $secondaryEmailWrap?.removeAttribute('data-ak-hidden');
  }

  function showErrorAlertNRedirect(userMail) {
    const name = localStorage['ak-user-name']?.split(/\s+/)[0] || '';
    alert(`${name ? `Hi ${name}\n` : ''}The email address: ${userMail}\nis not connected to another plan\nPlease ask your friend to add you to their plan\nor\nCreate your own plan`);
    window.location.href = '/free-trip-planner';
  }


  document.body.addEventListener('dragstart', handleDragStart);
  document.body.addEventListener('dragover', e => {
    handleDragOver(e);
    expandContentWrapOnDrag(e);
  });
  document.body.addEventListener('drop', handleDrop);

  function handleDragStart(e) {
    if (!e.target.closest('[data-ak="attraction-location"]')) return;
    const $dragEl = e.target.closest('[data-ak="attraction-location"]');
    const attractionName = $dragEl.querySelector('[data-ak="location-title"]').textContent.toLowerCase().trim();
    const fromTimeslot = $dragEl.closest('[data-ak-timeslot-wrap]').getAttribute('data-ak-timeslot-wrap').toLowerCase().trim();
    e.dataTransfer.setData('text/plain', JSON.stringify({ attractionName, fromTimeslot }));
    e.dataTransfer.dropEffect = 'move';
  }

  function handleDragOver(e) {
    if (!e.target.closest('[data-ak="allow-drop"]')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function expandContentWrapOnDrag(e) {
    if (!e.target.closest('[data-ak-timeslot-title]')) return;
    const $title = e.target.closest('[data-ak-timeslot-title]');
    const $contentWrap = $title.closest('[data-ak-timeslots]').querySelector('[data-ak-timeslot-content]');
    if ($contentWrap.style.height !== '0px') return;
    $title.click();
  }

  function handleDrop(e) {
    if (!e.target.closest('[data-ak="allow-drop"]')) return;
    const $dropZone = e.target.closest('[data-ak="allow-drop"]');
    e.preventDefault();

    const data = e.dataTransfer.getData('text/plain');
    const { attractionName, fromTimeslot } = JSON.parse(data);

    const { $currentSlide, slideIndex } = getCurrentSlideInfo();
    const $activeTimeslot = $currentSlide.querySelector('[data-ak-timeslots].active');
    const $morningTimeslot = $currentSlide.querySelector('[data-ak-timeslot="morning"]');
    const $timeslot = $activeTimeslot || $morningTimeslot;

    const matchingAttraction = [...document.querySelectorAll('[data-ak="attraction-location"]:not(.hidden)')].find(attraction => {
      const text = attraction.querySelector('[data-ak="location-title"]').textContent.toLowerCase().trim();
      return attractionName.includes(text);
    });

    if (matchingAttraction) {
      $dropZone.appendChild(matchingAttraction);
    } else {
      console.log('No matching attraction to move!');
    }

    const currentTimeslot = $dropZone.closest('[data-ak-timeslot-wrap]').getAttribute('data-ak-timeslot-wrap').toLowerCase().trim();
    const savedAttractions = localStorage['ak-attractions-saved'] ? JSON.parse(localStorage['ak-attractions-saved']) : {};
    const savedtimeslotAttractions = savedAttractions[`slide${slideIndex}`][fromTimeslot];

    if (savedtimeslotAttractions) {
      const savedAttr = savedtimeslotAttractions.find(attr => data.includes(attr.displayName.toLowerCase().trim()));
      if (savedAttr) {
        const draggedAttr = savedAttractions[`slide${slideIndex}`][fromTimeslot].splice(savedtimeslotAttractions.indexOf(savedAttr), 1)[0];
        savedAttractions[`slide${slideIndex}`][currentTimeslot] = savedAttractions[`slide${slideIndex}`][currentTimeslot] || [];
        savedAttractions[`slide${slideIndex}`][currentTimeslot].push(draggedAttr);
        localStorage['ak-attractions-saved'] = JSON.stringify(savedAttractions);
        localStorage['ak-update-attractions'] = true;
      }
    }
    setUnsavedChangesFlag();
  }


  async function handleSeverTiesToReferrer() {
    const $currentPlanWrap = document.querySelector('.ak-current-plan-wrap');
    $currentPlanWrap.classList.remove('hide');

    const $createOwnPlanBtn = document.querySelector('[data-ak="create-own-plan"]');
    $createOwnPlanBtn.classList.remove('hide');
    $createOwnPlanBtn.addEventListener('click', async () => {
      const btnTxt = $createOwnPlanBtn.textContent;
      $createOwnPlanBtn.textContent = 'Processing...';
      await severTiesToReferrer();
      $createOwnPlanBtn.textContent = btnTxt;
    });

    async function severTiesToReferrer() {
      if (!confirm(`Sever ties to ${localStorage['ak-user-name']}'s plan\nProceed?`)) return;

      await removeReferrerMailReference();
      await removeSecondaryEmailFromReferrer();

      for (const key of Object.keys(localStorage)) {
        if (!key.startsWith('ak-') || key.includes('ak-userMail')) continue;
        localStorage.removeItem(key);
      }

      localStorage['ak-user-name'] = auth.currentUser?.displayName?.split(' ')[0] || auth.currentUser?.email?.split('@')[0] || '';
      window.location.href = '/free-trip-planner';
    }

    async function removeReferrerMailReference() {
      const userMail = localStorage['ak-userMail'];
      const userRef = doc(db, 'locationsData', `user-${userMail}`);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) return;
      await updateDoc(userRef, { ModifiedAt: serverTimestamp(), referrerMail: deleteField() });
    }

    async function removeSecondaryEmailFromReferrer() {
      const referrerMail = localStorage['ak-referrer-mail'];
      const userRef = doc(db, 'locationsData', `user-${referrerMail}`);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) return;

      const { secondaryMail } = userSnap.data();
      secondaryMail.splice(secondaryMail.indexOf(referrerMail), 1);
      await updateDoc(userRef, { ModifiedAt: serverTimestamp(), secondaryMail });
    }
  }


  const $secondaryMailWrap = document.querySelector('[data-ak="secondary-email-wrap"]');
  const $addMailInp = $secondaryMailWrap.querySelector('.ak-add-mail-input-wrap');
  const $addMailBtn = $secondaryMailWrap.querySelector('.ak-mail-btn.ak-add-mail');
  const $saveMailBtn = $secondaryMailWrap.querySelector('.ak-mail-btn.ak-save-mail');
  const $btnsWrap = $secondaryMailWrap.querySelector('.ak-add-mail-btns');
  const saveMailBtnText = $saveMailBtn.textContent;

  $secondaryMailWrap.addEventListener('click', e => {
    if (!e.target.closest('.ak-remove-inp')) return;
    e.target.closest('.ak-remove-inp').closest('.ak-add-mail-input-wrap').remove();
  });

  $addMailBtn.addEventListener('click', () => {
    const $input = $addMailInp.cloneNode(true);
    $input.querySelector('.ak-add-mail-input').removeAttribute('id');
    $input.querySelector('.ak-add-mail-input').value = '';
    $input.querySelector('.ak-remove-inp').classList.remove('hidden');
    $secondaryMailWrap.insertBefore($input, $btnsWrap);
  });

  $saveMailBtn.addEventListener('click', async () => {
    const emailInputsNodeList = $secondaryMailWrap.querySelectorAll('.ak-add-mail-input');
    for (const input of emailInputsNodeList) {
      const mail = input.value.trim();
      if (!mail || !isValidEmail(mail)) {
        highlight(input);
        return;
      }
    }

    $saveMailBtn.textContent = 'Saving...';
    const mailArr = [...emailInputsNodeList].reduce((arr, inp) => {
      const mail = inp.value.trim();
      if (mail) arr.push(mail);
      return arr;
    }, []);

    await saveMailsDB(mailArr);
    $saveMailBtn.textContent = saveMailBtnText;
    $secondaryMailWrap.querySelectorAll('.ak-add-mail-input').forEach(inp => inp.value = '');
  });


  $saveItineraryBtn.addEventListener('click', async e => {
    e.preventDefault();
    await saveAttractionsDB();
    removeUnsavedChangesFlag();
  });


  const { Attractions, Passes } = await logSheetData();
  localStorage['ak-sheet-attractions'] = JSON.stringify(Attractions);

  const $ticketsTotalPrice = document.querySelector('[data-ak="tickets-total-price"]');
  const $ticketsNum = document.querySelectorAll('[data-ak="tickets-num"]');
  const $attractionSample = document.querySelector('[data-ak="attraction-sample"]');
  const $individualResultsContainer = document.querySelector('[data-ak="results-container"][named="individual"]');
  const $gocityResultsContainer = document.querySelector('[data-ak="results-container"][named="gocity"]');
  const $citypassResultsContainer = document.querySelector('[data-ak="results-container"][named="citypass"]');

  $individualResultsContainer.innerHTML = '';
  let attractionsTotalCost = 0;

  document.querySelector('[data-ak="calculate-passes"]').addEventListener('click', async e => {
    e.preventDefault();

    const attractions = JSON.parse(localStorage['ak-sheet-attractions']);
    if (!attractions) {
      console.log('No saved sheet attractions!');
      return;
    }

    $individualResultsContainer.innerHTML = '';
    $gocityResultsContainer.innerHTML = '';
    $citypassResultsContainer.innerHTML = '';
    attractionsTotalCost = 0;

    const attractionAddedMap = new Map();
    const placeIds = JSON.parse(localStorage['ak-place-ids'] || '[]');
    const userAddedAttractions = Object.entries(getAllSliderAttractionNames());
    const normalize = str => str?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';

    if (!placeIds.length && !userAddedAttractions.length) {
      resetPassCalc();
      return;
    }

    for (const [id, passInfo] of Object.entries(attractions)) {
      const { place_id, on_pass, attraction_name } = passInfo;

      const isMatchedById = placeIds.includes(place_id);
      const normalizedAttractionName = normalize(attraction_name);
      const isMatchedByName = userAddedAttractions.some(attraction => attraction[0].includes(normalizedAttractionName));

      if ((!isMatchedById && !isMatchedByName)
        || on_pass.trim().toLowerCase() !== 'true'
        || attractionAddedMap.has(normalizedAttractionName)) {
        continue;
      }

      attractionAddedMap.set(normalizedAttractionName, true);

      let { cost, passes, ticket_url } = passInfo;
      cost = cost.replace(/[^0-9.]/g, '');

      const $result = $attractionSample.cloneNode(true);
      $result.placeId = place_id;
      $result.removeAttribute('data-ak');
      $result.querySelector('[data-ak="ticket-name"]').innerHTML = `${attraction_name}<span class="attraction-cost"> - $${cost}</span>`;

      const $buyBtn = $result.querySelector('[data-ak="ticket-buy-btn"]');
      $buyBtn.setAttribute('buy-link', ticket_url);
      $buyBtn.addEventListener('click', () => window.open($buyBtn.getAttribute('buy-link')));

      $result.removeAttribute('data-ak-hidden');

      attractionsTotalCost += Number(cost);
      $individualResultsContainer.append($result);

      addAttractionToPassList(passes, 'go city', $result, place_id, $gocityResultsContainer);
      addAttractionToPassList(passes, 'citypass', $result, place_id, $citypassResultsContainer);
    }
    $individualResultsContainer.removeAttribute('data-ak-hidden');

    const passData = Object.entries(Passes);

    const $gocityName = document.querySelector('[data-ak="pass-name"][named="gocity"]');
    const $gocityPrice = document.querySelector('[data-ak="pass-price"][named="gocity"]');
    const $citypassName = document.querySelector('[data-ak="pass-name"][named="citypass"]');
    const $citypassPrice = document.querySelector('[data-ak="pass-price"][named="citypass"]');

    $ticketsTotalPrice.textContent = `$${attractionsTotalCost}`;
    $ticketsNum.forEach(n => n.textContent = $individualResultsContainer.children.length);

    function addAttractionToPassList(passes, passName, $resultEl, place_id, $passContainer) {
      const $result = $resultEl.cloneNode(true);
      $result.placeId = place_id;
      const $ticketName = $result.querySelector('[data-ak="ticket-name"]');
      const name = $ticketName.innerHTML.split('<span')[0].trim();
      $ticketName.innerHTML = name;
      $result.querySelector('[data-ak="ticket-buy-btn"]').remove();

      if (passes.toLowerCase().includes(passName)) {
        $result.classList.add('active');
        $passContainer.append($result);
        $passContainer.removeAttribute('data-ak-hidden');
        return name;
      } else {
        $result.classList.remove('active');
        $ticketName.innerHTML = `<p class="crossed-out">${$ticketName.textContent.trim()}</p>`;
        $ticketName.closest('.pcrn_list-item').classList.add('strikethrough');
        $passContainer.append($result);
        $passContainer.removeAttribute('data-ak-hidden');
        return undefined;
      }
    }

    populateGoCityPasses(passData, 'gocity_explorer', $gocityName, $gocityPrice, $gocityResultsContainer);
    populateCityPasses(passData, 'citypass', $citypassName, $citypassPrice, $citypassResultsContainer);

    function populateCityPasses(passData, passName, $passNameEl, $passPriceEl, $passContainer) {
      resetExtraPass($passNameEl);
      const passAttractionsNum = $passContainer.querySelectorAll('.active').length;

      if (!passAttractionsNum) {
        $passNameEl.textContent = $passNameEl.textContent.replace(/\s\S+$/, '');
        $passPriceEl.textContent = '$0';
        return;
      }

      const passMatches = passData.filter(([id, data]) => data.pass_id.includes(passName));
      const sortedPasses = passMatches.sort((a, b) => Number(a[1].attraction_count) - Number(b[1].attraction_count));
      const exactPass = sortedPasses.find(([id, pass]) => Number(pass.attraction_count) === passAttractionsNum);

      const c5Eligible = citypass5EligibilityCheck();

      if (c5Eligible) {
        if (exactPass) {
          $passNameEl.textContent = exactPass[1].pass_name;
          $passPriceEl.textContent = `$${exactPass[1].pass_price}`;
        } else {
          workoutLowerNUpperPass(
            sortedPasses,
            ([id, pass]) => pass.attraction_count >= passAttractionsNum,
            ([id, pass]) => pass.attraction_count <= passAttractionsNum,
            $passNameEl, $passPriceEl
          );
        }
      } else {
        if (exactPass && !exactPass[1].pass_name.toLowerCase().includes('c5')) {
          $passNameEl.textContent = exactPass[1].pass_name;
          $passPriceEl.textContent = `$${exactPass[1].pass_price}`;
        } else {
          runUpperLowerCalcForIneligibleC5(sortedPasses, passAttractionsNum, $passNameEl, $passPriceEl);
        }
      }
    }

    function runUpperLowerCalcForIneligibleC5(sortedPasses, passAttractionsNum, $passNameEl, $passPriceEl) {
      workoutLowerNUpperPass(
        sortedPasses,
        ([id, pass]) => pass.attraction_count >= passAttractionsNum && !pass.pass_name.toLowerCase().includes('c5'),
        ([id, pass]) => pass.attraction_count <= passAttractionsNum && !pass.pass_name.toLowerCase().includes('c5'),
        $passNameEl, $passPriceEl
      );
    }

    function workoutLowerNUpperPass(sortedPasses, upperLogic, lowerLogic, $passNameEl, $passPriceEl) {
      const passUpperLimit = sortedPasses.find(upperLogic);
      const passLowerLimit = [...sortedPasses].reverse().find(lowerLogic);

      let lowerLimitExists;
      if (passLowerLimit?.length) {
        $passNameEl.textContent = passLowerLimit[1].pass_name;
        $passPriceEl.textContent = `$${passLowerLimit[1].pass_price}`;
        lowerLimitExists = true;
      }

      showExtraPass($passNameEl, $passPriceEl, passUpperLimit, lowerLimitExists);
    }

    function populateGoCityPasses(passData, passName, $passNameEl, $passPriceEl, $passContainer) {
      resetExtraPass($passNameEl);
      const passAttractionsNum = $passContainer.querySelectorAll('.active').length;

      if (!passAttractionsNum) {
        $passNameEl.textContent = $passNameEl.textContent.replace(/\s\S+$/, '');
        $passPriceEl.textContent = '$0';
        return;
      }

      const passMatches = passData.filter(([id, data]) => data.pass_id.includes(passName));
      const sortedPasses = passMatches.sort((a, b) => Number(a[1].attraction_count) - Number(b[1].attraction_count));
      const exactPass = sortedPasses.find(([id, pass]) => Number(pass.attraction_count) === passAttractionsNum);

      if (exactPass) {
        $passNameEl.textContent = exactPass[1].pass_name;
        $passPriceEl.textContent = `$${exactPass[1].pass_price}`;
      } else {
        const passUpperLimit = sortedPasses.find(([id, pass]) => pass.attraction_count >= passAttractionsNum);
        const passLowerLimit = [...sortedPasses].reverse().find(([id, pass]) => pass.attraction_count <= passAttractionsNum);

        let lowerLimitExists;
        if (passLowerLimit?.length) {
          $passNameEl.textContent = passLowerLimit[1].pass_name;
          $passPriceEl.textContent = `$${passLowerLimit[1].pass_price}`;
          lowerLimitExists = true;
        }

        showExtraPass($passNameEl, $passPriceEl, passUpperLimit, lowerLimitExists);
      }

      $passNameEl.closest('[data-ak="pass-info"]').classList.remove('hidden');
    }

    function citypass5EligibilityCheck() {
      const addedAttractions = $citypassResultsContainer.querySelectorAll('.active');
      const empireStateBuilding = 'ChIJaXQRs6lZwokRY6EFpJnhNNE';
      const amnh = 'ChIJCXoPsPRYwokRsV1MYnKBfaI';
      const edge = 'ChIJ3aqq5Q1ZwokRb9hLO7Gyxgw';
      const moma = 'ChIJKxDbe_lYwokRVf__s8CPn-o';
      const requiredArr = [];
      const excludedArr = [];

      for (const attraction of addedAttractions) {
        const id = attraction.placeId;
        const name = attraction.querySelector('[data-ak="ticket-name"]').textContent;
        if (id.includes(empireStateBuilding) || id.includes(amnh)) {
          requiredArr.push(name);
        } else if (id.includes(edge) || id.includes(moma)) {
          excludedArr.push(name);
        }
      }

      return excludedArr.length === 0 && requiredArr.length >= 2;
    }

    const gocityNum = $gocityResultsContainer.children.length;
    if (gocityNum > 10) {
      const travelDays = document.querySelectorAll('.w-slider .w-slide').length - nonCountDays;
      const passMatches = passData.filter(([id, data]) => data.pass_id.includes('gocity_allinc'));
      const sortedPasses = passMatches.sort((a, b) => Number(a[1].attraction_count) - Number(b[1].attraction_count));
      const exactPass = sortedPasses.find(([id, pass]) => Number(pass.trip_days) === travelDays);

      if (exactPass) {
        showExtraPass($gocityName, $gocityPrice, exactPass, true);
      } else {
        const passLowerLimit = [...sortedPasses].reverse().find(([id, pass]) => pass.trip_days <= travelDays);
        if (passLowerLimit?.length) {
          showExtraPass($gocityName, $gocityPrice, passLowerLimit, true);
        }
      }
    }

    function showExtraPass($passName, $passPrice, passUpperLimit, lowerLimitExists) {
      if (!passUpperLimit?.length) return;
      const $passInfo = $passName.closest('[data-ak="pass-info"]');
      const $or = $passInfo.parentElement.querySelector('.ak-pass-or');

      resetExtraPass($passName);

      if (lowerLimitExists) {
        const $passInfoClone = $passInfo.cloneNode(true);
        $passInfoClone.classList.add('pass-upper');
        $passInfoClone.querySelector('[data-ak="pass-name"]').textContent = passUpperLimit[1].pass_name;
        $passInfoClone.querySelector('[data-ak="pass-price"]').textContent = `$${passUpperLimit[1].pass_price}`;
        $passInfoClone.classList.remove('hidden');
        $or.classList.remove('hide');
        $or.removeAttribute('data-ak-hidden');
        $or.insertAdjacentElement('afterend', $passInfoClone);
      } else {
        $passName.textContent = passUpperLimit[1].pass_name;
        $passPrice.textContent = `$${passUpperLimit[1].pass_price}`;
      }
    }

    function resetExtraPass($passName) {
      const $passInfo = $passName.closest('[data-ak="pass-info"]');
      const $or = $passInfo.parentElement.querySelector('.ak-pass-or');
      const $passUpper = $passInfo.parentElement.querySelector('.pass-upper');
      if ($or) {
        $or.classList.add('hide');
        $or.setAttribute('data-ak-hidden', true);
      }
      if ($passUpper) $passUpper.remove();
    }

    function resetPassCalc() {
      document.querySelectorAll('.ak-pass-or').forEach(or => {
        const $passInfo = or.parentElement.querySelector('[data-ak="pass-info"]');
        const $passName = $passInfo.querySelector('[data-ak="pass-name"]');
        const $passPrice = $passInfo.querySelector('[data-ak="pass-price"]');
        resetExtraPass($passName);
        $passName.textContent = $passName.textContent.replace(/\s\S+$/, '');
        $passPrice.textContent = '$0';
      });

      $ticketsTotalPrice.textContent = '$0';
      $ticketsNum.forEach(n => n.textContent = '0');
      $individualResultsContainer.innerHTML = '';
      $gocityResultsContainer.innerHTML = '';
      $citypassResultsContainer.innerHTML = '';
    }

    activateSpacers();

    function activateSpacers() {
      const $spacers = document.querySelectorAll('[data-ak-spacer]');
      const $orSpacers = document.querySelectorAll('.ak-pass-or:not([data-ak-spacer])');
      const allOrsHidden = [...$orSpacers].every(el => el.classList.contains('hide'));

      $spacers.forEach(el => {
        const $parent = el.parentElement;
        if ($parent.querySelector('.pass-upper') || allOrsHidden) {
          el.classList.add('hide');
          el.setAttribute('data-ak-hidden', true);
          el.classList.remove('non-visible');

          if (allOrsHidden && el.getAttribute('data-ak-center')) {
            el.classList.remove('hide');
            el.removeAttribute('data-ak-hidden');
            el.classList.add('non-visible');
          }
        } else {
          el.classList.remove('hide');
          el.removeAttribute('data-ak-hidden');
          el.classList.add('non-visible');
        }
      });
    }
  });


  // Main attraction autocomplete
  (async function setupAutocompleteInp() {
    await google.maps.importLibrary('places');

    const placeAutocomplete = new google.maps.places.PlaceAutocompleteElement({
      componentRestrictions: { country: ['us'] },
      includedRegionCodes: ['us'],
      locationBias: { radius: 5000.0, center: mapCenter },
    });

    document.querySelector('.ak-autocomplete').appendChild(placeAutocomplete);

    const searchAttractionsPlaceholderTxt = 'Add an activity...';

    placeAutocomplete.addEventListener('gmp-select', async res => {
      const { placePrediction } = res;
      const place = placePrediction.toPlace();
      await place.fetchFields({ fields: ['id', 'displayName', 'location', 'editorialSummary', 'types'] });

      const placeObj = place.toJSON();
      const { displayName } = placeObj;

      const $timeslot = document.querySelector('[data-ak-timeslot].active') || document.querySelector('[data-ak-timeslot="morning"]');
      const $timeslotWrap = $timeslot.querySelector('[data-ak-timeslot-wrap]');
      if (attractionExists($timeslotWrap, displayName)) {
        alert('Sorry, Already Added!');
        return;
      }

      if (!auth.currentUser) {
        if (addedAttractions >= attractionslimit) {
          alert('Max Limit Reached. Login To Add More');
          resetUserInputField();
          return;
        }
        updateAttractionsCount('+');
        localStorage['ak-update-merge-local'] = true;
      }

      resetUserInputField();
      function resetUserInputField() {
        const $userInput = res.target?.Dg;
        if (!$userInput) return;
        $userInput.value = '';
        $userInput.setAttribute('placeholder', searchAttractionsPlaceholderTxt);
      }

      if (place.viewport) {
        map.panTo(place.viewport);
      } else {
        map.panTo(place.location);
      }

      const { id, location: { lat, lng }, editorialSummary, types: type } = placeObj;

      const placeIds = JSON.parse(localStorage['ak-place-ids'] || '[]');
      if (!placeIds.includes(id)) {
        placeIds.push(id);
        localStorage['ak-place-ids'] = JSON.stringify(placeIds);
      }

      const { $currentSlide, slideIndex } = getCurrentSlideInfo();
      const marker = createMarker(displayName, { lat, lng }, editorialSummary, type);
      markerObj[`slide${slideIndex}`] = markerObj[`slide${slideIndex}`] || [];
      markerObj[`slide${slideIndex}`].push(marker);

      const saveObj = { location: { lat, lng }, displayName, editorialSummary, type, placeId: id };
      processAttractionSave($currentSlide, { slideIndex, displayName, marker, saveObj });
      setUnsavedChangesFlag();
    });

    function processAttractionSave($currentSlide, addNSaveObj) {
      const $activeTimeslot = $currentSlide.querySelector('[data-ak-timeslots].active');
      const $morningTimeslot = $currentSlide.querySelector('[data-ak-timeslot="morning"]');
      const $timeslot = $activeTimeslot || $morningTimeslot;

      if ($timeslot.querySelector('[data-ak-timeslot-content]').style.height === '0px') {
        $timeslot.querySelector('[data-ak-timeslot-title]').click();
      }

      const { slideIndex, displayName, marker, saveObj } = addNSaveObj;
      const $timeslotWrap = $timeslot.querySelector('[data-ak-timeslot-wrap]');
      const timeslotName = $timeslot.getAttribute('data-ak-timeslot');
      addAttractionToList(displayName, $timeslotWrap, marker, saveObj);
      saveAttractionLocal();
    }
  })();


  $attractionsSlider.addEventListener('click', e => {
    if (!e.target.closest('[data-ak-timeslot-title]')) return;
    const $title = e.target.closest('[data-ak-timeslot-title]');
    const $currentSlide = $title.closest('.w-slide');
    $currentSlide.querySelector('[data-ak-timeslots].active')?.classList.remove('active');
    $title.closest('[data-ak-timeslots]').classList.add('active');
  });

  $attractionsSlider.addEventListener('click', e => {
    handleSliderRemoveLocation(e);
  });

  document.querySelector('[data-ak="travel-details"]').addEventListener('click', e => {
    handleTravelResultsRemoveLocation(e);
  });

  document.body.addEventListener('click', e => {
    if (e.target.closest('[data-ak="locations-slider-wrap"]')) return;
    document.querySelector('.w-slide:not([aria-hidden="true"])')
      ?.querySelector('[data-ak-timeslots].active')
      ?.classList.remove('active');
  });

  document.body.addEventListener('click', e => {
    if (!e.target.closest('[data-ak="location-link"]')) return;
    const $location = e.target.closest('[data-ak="location-link"]').closest('[data-ak="attraction-location"]');

    if (!$location.marker) {
      console.log('Sorry! No location marker info.');
      return;
    }

    const lat = $location.marker?.position.lat || null;
    const lng = $location.marker?.position.lng || null;

    if (!lat) {
      console.log('Sorry! No location marker info.');
      return;
    }

    window.open(`${directionsUrlBase}?api=1&query=${lat}%2C${lng}`);
  });


  const ITINERARY_PAGE_2_URL = '/customize-itinerary-page-2';
  document.querySelector('[data-ak="continue-to-step2"]').addEventListener('click', e => {
    e.preventDefault();

    const slides = [...document.querySelectorAll('.w-slider .w-slide')];

    // A = total activity days
    const numberOfDays = slides.length - nonCountDays;
    localStorage['ak-number-of-days'] = numberOfDays;

    // Y = total attractions (morning section) across all slides
    const totalAttractions = slides.reduce((count, slide) => {
      return count + slide.querySelectorAll('[data-ak-timeslot-wrap="morning"] [data-ak="attraction-location"]:not(.hidden)').length;
    }, 0);
    localStorage['ak-y-total-attractions'] = totalAttractions;

    window.location.href = ITINERARY_PAGE_2_URL;
  });


  document.querySelector('.ak-map-pins-wrap input[type=radio][value="*"]')?.click();

  $mapPinsRadios.forEach(radioBtn => {
    radioBtn.addEventListener('click', () => showHidePins(radioBtn.value));
  });

  $sliderArrows.forEach(sliderArrow => {
    sliderArrow.addEventListener('click', () => {
      showHidePins(document.querySelector('[name="View-Map-Pins"]:checked')?.value);
    });
  });

});
// end window.addEventListener('load')


function isValidEmail(mail) {
  return /.@./.test(mail);
}

function highlight(inp) {
  inp.classList.add('active');
  inp.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => inp.classList.remove('active'), 2000);
}

async function saveMailsDB(mailArr) {
  const userMail = localStorage['ak-userMail'];

  for (const mail of mailArr) {
    const mailRef = doc(db, 'locationsData', `user-${mail}`);
    const mailSnap = await getDoc(mailRef);
    if (mailSnap.exists()) {
      alert(`Sorry!\nThe user: ${mail}\nAlready has a plan :)`);
      return;
    }
    await setDoc(mailRef, { CreatedAt: serverTimestamp(), referrerMail: userMail });
  }

  const userRef = doc(db, 'locationsData', `user-${userMail}`);
  const userSnap = await getDoc(userRef);
  const saveObj = { secondaryMail: arrayUnion(...mailArr) };

  if (userSnap.exists()) {
    saveObj.ModifiedAt = serverTimestamp();
    await updateDoc(userRef, saveObj);
  } else {
    saveObj.CreatedAt = serverTimestamp();
    await setDoc(userRef, saveObj);
  }

  return true;
}


async function retrieveDBData(userMail) {
  const userRef = doc(db, 'locationsData', `user-${userMail}`);
  const docSnap = await getDoc(userRef);
  if (!docSnap.exists()) console.log('No user with such email!', userMail);
  return docSnap.data();
}

function setupUserInfo(savedAttractions, tripName, travelDates, hotel, arrivalAirport, departureAirport) {
  processTripInfoHeader(tripName, travelDates);
  setupHotelNAirports(hotel, arrivalAirport, departureAirport);
  processSavedAttractions(savedAttractions);
}

function processTripInfoHeader(tripName, travelDates) {
  setupTripNameNTravelDates(tripName, travelDates);
  showTripInfoHeader();
}

function processSavedAttractions(savedAttractions) {
  if (savedAttractions) {
    localStorage.removeItem('ak-place-ids');
    restoreSavedAttractions(JSON.parse(savedAttractions));
  }
}

function setupTripNameNTravelDates(tripName, travelDates) {
  if (tripName) {
    tripName = tripName.split(/\s+/)[0];
    $tripTitle.querySelector('[data-ak="trip-user-name"]').textContent = `${tripName}'s`;
    localStorage['ak-user-name'] = tripName;
  }

  if (travelDates) {
    const { flatpickrDate } = JSON.parse(travelDates);
    setupTravelDates(flatpickrDate);
    localStorage['ak-travel-days'] = travelDates;
  }
}

function showTripInfoHeader() {
  $tripTitleInfo.classList.remove('hidden');
}

function setupTravelDates(flatpickrDate) {
  let [startDate, endDate] = flatpickrDate.split(/\s+to\s+/);

  const daysArr = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthArr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  processTitleDates();
  setupSliderDates();
  reInitWebflow();

  function setupSliderDates() {
    const $firstSlide = $attractionsSlider.querySelector('.w-slide');
    const theStartDate = new Date(startDate);
    const numberOfDays = daysBetween(startDate, endDate);

    updateDayNDate($firstSlide, getDateDetails(theStartDate));
    $attractionsSliderMask.querySelectorAll('.w-slide')[1]?.remove();

    for (let i = 0; i < numberOfDays; i++) {
      const newDate = new Date(theStartDate.setDate(theStartDate.getDate() + 1));
      const $slideClone = $firstSlide.cloneNode(true);
      updateDayNDate($slideClone, getDateDetails(newDate));
      $attractionsSliderMask.append($slideClone);
    }
  }

  function updateDayNDate($slide, { day, month, date, year }) {
    $slide.querySelector('[data-ak="timeslots-day"]').textContent = day;
    $slide.querySelector('[data-ak="timeslots-date"]').textContent = `${month} ${date}, ${year}`;
  }

  function getDateDetails(theDate) {
    return {
      day: daysArr[theDate.getDay()],
      month: monthArr[theDate.getMonth()],
      date: theDate.getDate(),
      year: theDate.getFullYear(),
    };
  }

  function daysBetween(startDate, endDate) {
    const msPerDay = 24 * 60 * 60 * 1000;
    return (new Date(endDate).getTime() - new Date(startDate).getTime()) / msPerDay;
  }

  function processTitleDates() {
    const titleStartDate = new Date(startDate);
    const titleEndDate = new Date(endDate);
    const fmt = d => `${monthArr[d.getMonth()]} ${d.getDate()}`;
    const s = fmt(titleStartDate);
    const e = fmt(titleEndDate);
    document.querySelector('[data-ak="title-travel-dates"]').textContent = s === e ? s : `${s} - ${e}`;
  }

  function reInitWebflow() {
    Webflow.destroy();
    Webflow.ready();
    Webflow.require('ix2').init();
    Webflow.require('slider').redraw();
  }
}

function setupHotelNAirports(hotel, arrivalAirport, departureAirport) {
  if (hotel && hotel !== 'undefined') {
    processLocation(hotel, '[data-ak="hotel-search-result"]');
  }
  if (arrivalAirport && arrivalAirport !== 'undefined') {
    processLocation(arrivalAirport, '[data-ak="airport-search-result"][data-ak-airport="arrival"]');
  }
  if (departureAirport && departureAirport !== 'undefined') {
    processLocation(departureAirport, '[data-ak="airport-search-result"][data-ak-airport="departure"]');
  }

  function processLocation(location, $resultWrapName) {
    const locationDetails = JSON.parse(location);
    const $resultWrap = document.querySelector($resultWrapName);
    $resultWrap.saveObj = location;
    setupLocation(location, locationDetails, $resultWrap);
  }

  function setupLocation(location, locationDetails, $resultWrap) {
    let { displayName, location: { lat, lng }, editorialSummary, type } = locationDetails;
    if (!type) type = locationDetails.types;

    let marker;
    if (location === hotel) {
      marker = createMarker(displayName, { lat, lng }, editorialSummary, type, hotelMarkerPinUrl);
      markerObj['hotel'] = marker;
    } else {
      const pin = getCorrectTransportationPinUrl(type);
      marker = createMarker(displayName, { lat, lng }, editorialSummary, type, pin);
      markerObj[location === arrivalAirport ? 'airport-arrival' : 'airport-departure'] = marker;
    }

    addLocationToResultWrap(displayName, marker, $resultWrap);
  }
}

async function logSheetData() {
  const res = await fetch(firebaseUrl);
  return res.json();
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

function createMarker(title, position, editorialSummary = title, type = [], markerPinSrc = cameraPinUrl) {
  const markerPinImg = document.createElement('img');
  const isRestaurant = type.includes('restaurant') || type.includes('food');
  markerPinImg.src = isRestaurant && markerPinSrc !== hotelMarkerPinUrl ? foodForkPinUrl : markerPinSrc;
  markerPinImg.className = 'ak-marker-pin';

  const marker = new google.maps.marker.AdvancedMarkerElement({
    map,
    position,
    title,
    content: markerPinImg,
    gmpClickable: true,
  });

  const content = `<div class="marker-popup-title">${title}</div><div class="marker-popup-desc">${editorialSummary || title}</div>`;
  marker.addListener('gmp-click', () => {
    infoWindow.close();
    infoWindow.setContent(content);
    infoWindow.open(marker.map, marker);
  });

  return marker;
}

function format(str) {
  if (!str) return;
  return str.trim().split(/\s+/).map(capitalize).join(' ');
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

(async function setupHotelAutocomplete() {
  await google.maps.importLibrary('places');

  const placeAutocomplete = new google.maps.places.PlaceAutocompleteElement({
    componentRestrictions: { country: ['us'] },
    includedRegionCodes: ['us'],
    locationBias: { radius: 5000.0, center: mapCenter },
    includedPrimaryTypes: ['lodging', 'hotel'],
  });

  document.querySelector('[data-ak="hotel-autocomplete"]')?.appendChild(placeAutocomplete);

  placeAutocomplete.addEventListener('gmp-select', async res => {
    const { placePrediction } = res;
    const place = placePrediction.toPlace();
    await place.fetchFields({ fields: ['displayName', 'location', 'editorialSummary'] });

    map.panTo(place.viewport || place.location);

    const placeObj = place.toJSON();
    const { displayName, location: { lat, lng }, editorialSummary, types: type } = placeObj;

    const $userInputWrap = res.target?.Zg;
    const $userInput = $userInputWrap?.querySelector('input');
    if ($userInput) $userInput.value = '';

    const marker = createMarker(displayName, { lat, lng }, editorialSummary, type, hotelMarkerPinUrl);
    if (markerObj['hotel']) markerObj['hotel'].setMap(null);
    markerObj['hotel'] = marker;

    addLocationToResultWrap(displayName, marker, document.querySelector('[data-ak="hotel-search-result"]'));
    setUnsavedChangesFlag();

    localStorage['ak-hotel'] = JSON.stringify(placeObj);
    localStorage['ak-update-hotel'] = true;
  });
})();

(async function setupAirportAutocomplete() {
  await google.maps.importLibrary('places');

  document.querySelectorAll('[data-ak="airport-autocomplete"]').forEach(autocomplete => {
    const placeAutocomplete = new google.maps.places.PlaceAutocompleteElement({
      componentRestrictions: { country: ['us'] },
      includedRegionCodes: ['us'],
      locationBias: { radius: 5000.0, center: mapCenter },
      includedPrimaryTypes: ['airport', 'ferry_terminal', 'international_airport', 'bus_station', 'train_station'],
    });

    autocomplete.appendChild(placeAutocomplete);

    placeAutocomplete.addEventListener('gmp-select', async res => {
      const { placePrediction } = res;
      const place = placePrediction.toPlace();
      await place.fetchFields({ fields: ['displayName', 'location', 'editorialSummary', 'types'] });

      map.panTo(place.viewport || place.location);

      const placeObj = place.toJSON();
      const { displayName, location: { lat, lng }, editorialSummary, types: type } = placeObj;

      const $userInputWrap = res.target?.Zg;
      const $userInput = $userInputWrap?.querySelector('input');
      if ($userInput) $userInput.value = '';

      const pin = getCorrectTransportationPinUrl(type);
      const marker = createMarker(displayName, { lat, lng }, editorialSummary, type, pin);

      const airportType = autocomplete.getAttribute('data-ak-airport');
      if (airportType.includes('arrival')) {
        localStorage['ak-arrival-airport'] = JSON.stringify(placeObj);
        localStorage['ak-update-arrival-airport'] = true;
        if (markerObj['airport-arrival']) markerObj['airport-arrival'].setMap(null);
        markerObj['airport-arrival'] = marker;
      } else {
        localStorage['ak-departure-airport'] = JSON.stringify(placeObj);
        localStorage['ak-update-departure-airport'] = true;
        if (markerObj['airport-departure']) markerObj['airport-departure'].setMap(null);
        markerObj['airport-departure'] = marker;
      }

      const $resultWrap = autocomplete.closest('.form_row').querySelector('[data-ak="airport-search-result"]');
      addLocationToResultWrap(displayName, marker, $resultWrap);
      setUnsavedChangesFlag();
    });
  });
})();

function getCorrectTransportationPinUrl(type) {
  if (!type) return airportMarkerPinUrl;
  if (type.includes('bus_station')) return busPinUrl;
  if (type.includes('train_station')) return trainPinUrl;
  return airportMarkerPinUrl;
}

function addLocationToResultWrap(name, marker, $resultWrap) {
  const $location = document.querySelector('[data-ak="attraction-location"]').cloneNode(true);
  $location.classList.remove('hidden');
  $location.querySelector('[data-ak="location-title"]').textContent = name;
  $location.querySelector('[data-ak="location-link-text"]').textContent = name;
  $location.marker = marker;
  $resultWrap.innerHTML = '';
  $resultWrap.append($location);
}

async function saveAttractionsDB() {
  if (!localStorage['ak-userMail']) return;
  const userMail = localStorage['ak-referrer-mail'] || localStorage['ak-userMail'];
  const userRef = doc(db, 'locationsData', `user-${userMail}`);
  const userSnap = await getDoc(userRef);

  const saveObj = {
    hotel: localStorage['ak-hotel'] || '',
    arrivalAirport: localStorage['ak-arrival-airport'] || '',
    departureAirport: localStorage['ak-departure-airport'] || '',
    tripName: localStorage['ak-user-name'] || '',
    travelDates: localStorage['ak-travel-days'] || '',
    savedAttractions: getCurrentUserAttractions(),
  };

  if (userSnap.exists()) {
    saveObj.ModifiedAt = serverTimestamp();
    await updateDoc(userRef, saveObj);
  } else {
    saveObj.CreatedAt = serverTimestamp();
    await setDoc(userRef, saveObj);
  }

  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith('ak-update')) continue;
    localStorage.removeItem(key);
  }
}

function getCurrentUserAttractions() {
  const savedAttractions = {};

  $attractionsSlider.querySelectorAll('.w-slide').forEach((slide, n) => {
    savedAttractions[`slide${n + 1}`] = {};
    const slideObj = savedAttractions[`slide${n + 1}`];

    slide.querySelectorAll('[data-ak-timeslots] [data-ak-timeslot-content]').forEach(timeslotContent => {
      const timeslot = timeslotContent.querySelector('[data-ak-timeslot-wrap]').getAttribute('data-ak-timeslot-wrap');
      slideObj[timeslot] = [];

      timeslotContent.querySelectorAll('[data-ak="attraction-location"]:not(.hidden)').forEach(attraction => {
        const { location, displayName, editorialSummary, placeId } = attraction.saveObj;
        slideObj[timeslot].push({ location, displayName, editorialSummary, placeId });
      });
    });
  });

  return JSON.stringify(savedAttractions);
}

async function createUserInFirebase(userMail) {
  if (!userMail) return;
  const userRef = doc(db, 'locationsData', `user-${userMail}`);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) return;
  await setDoc(userRef, { CreatedAt: serverTimestamp() });
}

function updateAttractionsCount(sign) {
  addedAttractions = sign === '+' ? addedAttractions + 1 : addedAttractions - 1;
  localStorage['ak-addedAttractions-count'] = addedAttractions;
}

function attractionExists(wrap, name) {
  return [...wrap.querySelectorAll('[data-ak="attraction-location"]:not(.hidden) [data-ak="location-title"]')]
    .some(el => el.textContent.toLowerCase().trim() === name.toLowerCase().trim());
}

function saveAttractionLocal() {
  localStorage['ak-attractions-saved'] = getCurrentUserAttractions();
  localStorage['ak-update-attractions'] = true;
}

function handleTravelResultsRemoveLocation(e) {
  if (!e.target.closest('[data-ak="remove-location"]')) return;
  const $removeBtn = e.target.closest('[data-ak="remove-location"]');
  const $attraction = $removeBtn.closest('[data-ak="attraction-location"]');
  const $resultWrap = $removeBtn.closest('[data-ak-search-result]');

  if ($attraction.marker) $attraction.marker.setMap(null);

  const airportType = $resultWrap.getAttribute('data-ak-airport');
  const dataAk = $resultWrap.getAttribute('data-ak');

  if (airportType?.includes('arrival')) {
    localStorage.removeItem('ak-arrival-airport');
    delete markerObj['airport-arrival'];
  } else if (airportType) {
    localStorage.removeItem('ak-departure-airport');
    delete markerObj['airport-departure'];
  } else if (dataAk?.includes('hotel')) {
    localStorage.removeItem('ak-hotel');
    delete markerObj['hotel'];
  }

  $attraction.remove();
  setUnsavedChangesFlag();
}

function handleSliderRemoveLocation(e) {
  if (!e.target.closest('[data-ak="remove-location"]')) return;
  const $removeBtn = e.target.closest('[data-ak="remove-location"]');
  const $attraction = $removeBtn.closest('[data-ak="attraction-location"]');

  const { slideIndex } = getCurrentSlideInfo();
  const savedAttractions = localStorage['ak-attractions-saved'];
  if (savedAttractions && Object.keys(savedAttractions).length) {
    const attrName = $attraction.querySelector('[data-ak="location-title"]').textContent.toLowerCase().trim();
    const savedAttractionsParsed = JSON.parse(savedAttractions);
    const timeslot = $removeBtn.closest('[data-ak-timeslot-wrap]').getAttribute('data-ak-timeslot-wrap').toLowerCase().trim();
    const timeslotArr = savedAttractionsParsed[`slide${slideIndex}`][timeslot];
    const attrMatch = timeslotArr?.find(attr => attrName.includes(attr.displayName.toLowerCase().trim()));
    if (attrMatch) timeslotArr.splice(timeslotArr.indexOf(attrMatch), 1);
    localStorage['ak-attractions-saved'] = JSON.stringify(savedAttractionsParsed);
    localStorage['ak-update-attractions'] = true;
  }

  if ($attraction.marker) {
    $attraction.marker.setMap(null);
    const markers = markerObj[`slide${slideIndex}`];
    if (markers) markers.splice(markers.indexOf($attraction.marker), 1);
  }

  $attraction.remove();
  setUnsavedChangesFlag();

  if (!auth.currentUser) updateAttractionsCount('-');

  if ($attraction.placeId) {
    const placeIds = JSON.parse(localStorage['ak-place-ids'] || '[]');
    const idIndex = placeIds.indexOf($attraction.placeId);
    placeIds.splice(idIndex, 1);
    localStorage['ak-place-ids'] = JSON.stringify(placeIds);
  }
}

function getCurrentSlideInfo() {
  const $currentSlide = document.querySelector('.w-slide:not([aria-hidden="true"])');
  const slideIndex = [...$attractionsSliderMask.querySelectorAll('.w-slide')].indexOf($currentSlide) + 1;
  return { $currentSlide, slideIndex };
}

function restoreSavedAttractions(savedAttractions) {
  for (const [slide, attractions] of Object.entries(savedAttractions)) {
    const slideNum = Number(slide.match(/\d+/)[0]);
    const $currentSlide = [...$attractionsSliderMask.querySelectorAll('.w-slide')][slideNum - 1];
    if (!$currentSlide) continue;

    const { morning, afternoon, evening } = attractions;
    if (morning?.length) processSectionAttractions(morning, $currentSlide.querySelector('[data-ak-timeslot-wrap="morning"]'), slideNum);
    if (afternoon?.length) processSectionAttractions(afternoon, $currentSlide.querySelector('[data-ak-timeslot-wrap="afternoon"]'), slideNum);
    if (evening?.length) processSectionAttractions(evening, $currentSlide.querySelector('[data-ak-timeslot-wrap="evening"]'), slideNum);
  }

  $attractionsSliderMask.querySelector('.w-slide .active')?.classList.remove('active');

  function processSectionAttractions(attractions, $sectionWrap, slideNum) {
    attractions.forEach(({ displayName, editorialSummary, location, type, placeId }) => {
      const marker = createMarker(displayName, location, editorialSummary, type);
      addAttractionToList(displayName, $sectionWrap, marker, { displayName, editorialSummary, location, placeId });
      markerObj[`slide${slideNum}`] = markerObj[`slide${slideNum}`] || [];
      markerObj[`slide${slideNum}`].push(marker);
    });

    const $timeslotSec = $sectionWrap.closest('[data-ak-timeslots]');
    if ($timeslotSec.querySelector('[data-ak-timeslot-content]').style.height === '0px') {
      $timeslotSec.querySelector('[data-ak-timeslot-title]').click();
    }
  }
}

function setUnsavedChangesFlag() {
  $unsavedChanges.classList.remove('hide');
  localStorage['ak-unsaved-changes'] = true;
}

function removeUnsavedChangesFlag() {
  $unsavedChanges.classList.add('hide');
  localStorage.removeItem('ak-unsaved-changes');
}

function showHidePins(val) {
  if (!val) return;
  if (val === '*') {
    showAllPins();
  } else {
    filterByDay();
  }
}

function showAllPins() {
  for (const [key, markerArr] of Object.entries(markerObj)) {
    if (!key.startsWith('slide')) continue;
    markerArr.forEach(marker => marker.setMap(map));
  }
}

function hideAllPins() {
  for (const [key, markerArr] of Object.entries(markerObj)) {
    if (!key.startsWith('slide')) continue;
    markerArr.forEach(marker => marker.setMap(null));
  }
}

function showSlidePins() {
  const { slideIndex } = getCurrentSlideInfo();
  const markers = markerObj[`slide${slideIndex}`];
  if (markers) markers.forEach(marker => marker.setMap(map));
}

function filterByDay() {
  hideAllPins();
  showSlidePins();
}

function getAllSliderAttractionNames() {
  const normalize = str => str?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
  const savedAttractions = {};

  $attractionsSlider.querySelectorAll('.w-slide').forEach(slide => {
    slide.querySelectorAll('[data-ak-timeslots] [data-ak-timeslot-content]').forEach(timeslotContent => {
      timeslotContent.querySelectorAll('[data-ak="attraction-location"]:not(.hidden)').forEach(attraction => {
        const name = attraction.querySelector('[data-ak="location-title"]').textContent.trim();
        savedAttractions[normalize(name)] = attraction.placeId;
      });
    });
  });

  localStorage['ak-user-added-items'] = JSON.stringify(savedAttractions);
  return savedAttractions;
}
