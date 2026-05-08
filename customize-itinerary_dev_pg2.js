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

const firebaseUrl = 'https://getspreadsheetdata-qqhcjhxuda-uc.a.run.app';

async function initPage2() {
  const { Attractions, Passes } = await fetchSheetData();
  localStorage['ak-sheet-attractions'] = JSON.stringify(Attractions);
  preCalculatePassStats(Attractions, Passes);
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
  document.querySelectorAll('[data-ak="tickets-num"]').forEach(el => el.textContent = Y);

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

