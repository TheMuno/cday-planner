/**
 * Page 2 — Pass Stats Pre-Calculator
 * Populates [X], [Y], [A], [B] before the user hits Calculate.
 *
 * Sources:
 *   A  = localStorage['ak-number-of-days']
 *   Y  = localStorage['ak-y-total-attractions']
 *   X  = derived — count of user's selected attractions that are on a pass
 *   B  = (([A]-Day All Inclusive price) - (GoCity Explorer price)) * adults
 *        adults defaults to 1
 */

const page1Url    = '/customize-itinerary';
const firebaseUrl = 'https://getspreadsheetdata-qqhcjhxuda-uc.a.run.app';

let _passes = null;

async function initPage2() {
  const { Attractions, Passes } = await fetchSheetData();
  localStorage['ak-sheet-attractions'] = JSON.stringify(Attractions);
  _passes = Passes;
  preCalculatePassStats(Attractions, Passes);
  setupPassCalculator();
}

async function fetchSheetData() {
  const res = await fetch(firebaseUrl);
  return res.json();
}

function preCalculatePassStats(Attractions, Passes) {
  const A = Number(localStorage['ak-number-of-days'] || 0);
  const Y = Number(localStorage['ak-y-total-attractions'] || 0);
  const adults = Number(localStorage['ak-number-of-adults'] || 1);

  // Always populate A and Y immediately
  document.querySelectorAll('[data-ak="number-of-days"]').forEach(el => el.textContent = A);
  document.querySelectorAll('[data-ak="init-tickets-num"]').forEach(el => el.textContent = Y);

  const placeIds = JSON.parse(localStorage['ak-place-ids'] || '[]');
  let userAddedAttractions = JSON.parse(localStorage['ak-user-added-items'] || '[]');
  if (userAddedAttractions.length) userAddedAttractions = Object.entries(userAddedAttractions);

  if (!Attractions || (!placeIds.length && !userAddedAttractions.length)) return;

  const normalize = (str) => str?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
  const seenNames = new Map();
  let X = 0;

  for (const [id, passInfo] of Object.entries(Attractions)) {
    const { place_id, on_pass, attraction_name, passes } = passInfo;
    const normalizedName = normalize(attraction_name);

    const isMatchedById = placeIds.includes(place_id);
    const isMatchedByName = userAddedAttractions.some(a => a[0].includes(normalizedName));

    if ((!isMatchedById && !isMatchedByName) || seenNames.has(normalizedName)) continue;
    seenNames.set(normalizedName, true);

    if (on_pass?.trim().toLowerCase() === 'true') {
      const isOnGoCity   = passes?.toLowerCase().includes('go city');
      const isOnCityPass = passes?.toLowerCase().includes('citypass');
      if (isOnGoCity || isOnCityPass) X++;
    }
  }

  const $onPassCounter = document.querySelector('[data-ak="on-pass-tickets"]');
  if ($onPassCounter) $onPassCounter.textContent = X;

  const B = calcB(Passes, A, X, adults);
  const $savings = document.querySelector('[data-ak="allinc-vs-best-savings"]');
  if ($savings && B !== null) $savings.textContent = B;
}

/**
 * B = (([A]-Day All Inclusive price) - (GoCity Explorer price for X attractions)) * adults
 * Returns null if either pass cannot be found.
 */
function calcB(Passes, tripDays, attractionsOnPass, adults) {
  if (!Passes) return null;

  const passData = Object.entries(Passes);

  // [A]-Day All Inclusive — exact match on trip_days, default to 1-Day if A is 0 or unset
  const effectiveDays = tripDays || 1;

  const allIncPasses = passData
    .filter(([id, p]) => p.pass_id?.includes('gocity_allinc'))
    .sort((a, b) => Number(a[1].trip_days) - Number(b[1].trip_days));

  const exactAllInc = allIncPasses.find(([id, p]) => Number(p.trip_days) === effectiveDays)
    || allIncPasses.find(([id, p]) => Number(p.trip_days) === 1); // hard fallback to 1-Day
  if (!exactAllInc) return null;

  const allIncPrice = Number(exactAllInc[1].pass_price) || 0;

  console.log('passData:', passData)
  console.log('effectiveDays:', effectiveDays)
  console.log('allIncPasses:', allIncPasses)
  console.log('exactAllInc:', exactAllInc)

  // GoCity Explorer — best pass that covers the user's attractions count
  const explorerPasses = passData
    .filter(([id, p]) => p.pass_id?.includes('gocity_explorer'))
    .sort((a, b) => Number(a[1].attraction_count) - Number(b[1].attraction_count));

  const exactExplorer = explorerPasses.find(([id, p]) => Number(p.attraction_count) === attractionsOnPass);
  const bestExplorer  = exactExplorer
    || explorerPasses.find(([id, p]) => Number(p.attraction_count) >= attractionsOnPass)
    || [...explorerPasses].reverse().find(([id, p]) => Number(p.attraction_count) <= attractionsOnPass);

  if (!bestExplorer) return null;

  const explorerPrice = Number(bestExplorer[1].pass_price) || 0;

  console.log(`Explorer_found: explorer_${bestExplorer[1].attraction_count} valued at $${explorerPrice}`);
  console.log(`All-inclusive_found: all-inclusive_${exactAllInc[1].trip_days} valued at $${allIncPrice}`);

  const B = (allIncPrice - explorerPrice) * adults;
  return B > 0 ? B : 0;
}

function showRedirectLoader(message) {
  if (!document.getElementById('pg2-spinner-style')) {
    const style = document.createElement('style');
    style.id = 'pg2-spinner-style';
    style.textContent = "@keyframes pg2-spin { to { transform: rotate(360deg); } }";
    document.head.appendChild(style);
  }
  const overlay = document.createElement('div');
  overlay.id = 'pg2-loader-overlay';
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0',
    background: 'rgba(255,255,255,0.5)',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    gap: '12px', zIndex: '9999',
  });
  const redirecting = document.createElement('p');
  redirecting.textContent = 'Redirecting...';
  Object.assign(redirecting.style, { margin: '0', fontSize: '14px', color: '#111' });
  overlay.appendChild(redirecting);
  const label = document.createElement('p');
  label.textContent = message;
  Object.assign(label.style, { margin: '0', fontSize: '14px', color: '#111' });
  overlay.appendChild(label);
  const spinner = document.createElement('div');
  Object.assign(spinner.style, {
    width: '40px', height: '40px',
    border: '4px solid #e5e7eb', borderTopColor: '#111',
    borderRadius: '50%', animation: 'pg2-spin 0.7s linear infinite',
  });
  overlay.appendChild(spinner);
  document.body.appendChild(overlay);
}

const pg1Keys = ['ak-number-of-days', 'ak-place-ids'];
const missingPg1Data = pg1Keys.some(k => !localStorage[k]);
const notLoggedIn = !localStorage['ak-userMail'];

if (missingPg1Data || notLoggedIn) {
  const reason = notLoggedIn ? 'User not logged in' : 'No attractions added';
  showRedirectLoader(reason);
  setTimeout(() => { window.location.href = page1Url; }, 1500);
}

initPage2();

// Page Title

const $tripTitleInfo = document.querySelector('.ak-trip-info');
const $tripTitle = $tripTitleInfo.querySelector('[data-ak="trip-title"]');

function populateTripInfoHeader() {
  const tripName = localStorage['ak-user-name'];
  const travelDates = localStorage['ak-travel-days'];

  if (tripName) {
    $tripTitle.querySelector('[data-ak="trip-user-name"]').textContent = `${tripName.split(/\s+/)[0]}'s`;
  }

  if (travelDates) {
    const { flatpickrDate } = JSON.parse(travelDates);
    const [startDate, endDate] = flatpickrDate.split(/\s+to\s+/);
    const monthArr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const fmt = d => `${monthArr[d.getMonth()]} ${d.getDate()}`;
    const s = fmt(new Date(startDate));
    const e = fmt(new Date(endDate));
    document.querySelector('[data-ak="title-travel-dates"]').textContent = s === e ? s : `${s} - ${e}`;
  }

  $tripTitleInfo.classList.remove('hidden');
}

populateTripInfoHeader();

function setupPassCalculator() {
  const $ticketsTotalPrice = document.querySelector('[data-ak="tickets-total-price"]');
  const $ticketsNum = document.querySelectorAll('[data-ak="tickets-num"]');
  const $attractionSample = document.querySelector('[data-ak="attraction-sample"]');
  const $individualResultsContainer = document.querySelector('[data-ak="results-container"][named="individual"]');
  const $gocityResultsContainer = document.querySelector('[data-ak="results-container"][named="gocity"]');
  const $citypassResultsContainer = document.querySelector('[data-ak="results-container"][named="citypass"]');

  if ($individualResultsContainer) $individualResultsContainer.innerHTML = '';
  let attractionsTotalCost = 0;

  document.querySelector('[data-ak="calculate-passes"]')?.addEventListener('click', async e => {
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
    const userAddedAttractions = Object.entries(JSON.parse(localStorage['ak-user-added-items'] || '{}'));
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

    const passData = Object.entries(_passes);

    const $gocityName = document.querySelector('[data-ak="pass-name"][named="gocity"]');
    const $gocityPrice = document.querySelector('[data-ak="pass-price"][named="gocity"]');
    const $citypassName = document.querySelector('[data-ak="pass-name"][named="citypass"]');
    const $citypassPrice = document.querySelector('[data-ak="pass-price"][named="citypass"]');

    $ticketsTotalPrice.textContent = `$${attractionsTotalCost}`;
    // $ticketsNum.forEach(n => n.textContent = $individualResultsContainer.children.length);

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
      const travelDays = Number(localStorage['ak-number-of-days'] || 0);
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
}

const $gotoItineraryList = document.querySelector('[data-ak="open-itinerary-list"]');
$gotoItineraryList.addEventListener('click', e => {
  e.preventDefault(); 
  const userMail = localStorage['ak-userMail'];
  $gotoItineraryList.href = `${$gotoItineraryList.href}?id=${userMail}`;
  window.location.href = $gotoItineraryList.href;
});

