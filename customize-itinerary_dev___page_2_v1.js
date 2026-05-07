/**
 * Page 2 — Pass Stats Pre-Calculator
 * Populates [X], [Y], [A], [B] before the user hits Calculate.
 *
 * Sources:
 *   A  = localStorage['ak-number-of-days']
 *   Y  = localStorage['ak-y-total-attractions']
 *   X  = derived — count of user's selected attractions that are on a pass
 *   B  = (GoCity Explorer price) - ([A]-Day All Inclusive price * adults)
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
  // --- A & Y from localStorage ---
  const A = Number(localStorage['ak-number-of-days'] || 0);
  const Y = Number(localStorage['ak-y-total-attractions'] || 0);

  const placeIds = JSON.parse(localStorage['ak-place-ids'] || '[]');
  let userAddedAttractions = JSON.parse(localStorage['ak-user-added-items'] || '[]');
  if (userAddedAttractions.length) userAddedAttractions = Object.entries(userAddedAttractions);

  if (!Attractions || (!placeIds.length && !userAddedAttractions.length)) return;

  const normalize = (str) => str?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
  const seenNames = new Map();

  let X = 0; // attractions on a pass

  for (const [id, passInfo] of Object.entries(Attractions)) {
    const { place_id, on_pass, attraction_name, passes } = passInfo;
    const normalizedName = normalize(attraction_name);

    const isMatchedById = placeIds.includes(place_id);
    const isMatchedByName = userAddedAttractions.some(a => a[0].includes(normalizedName));

    if ((!isMatchedById && !isMatchedByName) || seenNames.has(normalizedName)) continue;
    seenNames.set(normalizedName, true);

    if (on_pass?.trim().toLowerCase() === 'true') {
      const isOnGoCity  = passes?.toLowerCase().includes('go city');
      const isOnCityPass = passes?.toLowerCase().includes('citypass');
      if (isOnGoCity || isOnCityPass) X++;
    }
  }

  // --- B: Explorer price - (A-Day All Inclusive price * adults) ---
  const adults = Number(localStorage['ak-number-of-adults'] || 1);
  const B = calcB(Passes, A, X, adults);

  // --- Populate DOM ---
  const $onPassCounter   = document.querySelector('[data-ak="on-pass-tickets"]');      // [X]
  const $totalAttractions = document.querySelectorAll('[data-ak="tickets-num"]');       // [Y]
  const $daysCounter     = document.querySelectorAll('[data-ak="number-of-days"]');     // [A]
  const $savings         = document.querySelector('[data-ak="allinc-vs-best-savings"]'); // [B]

  if ($onPassCounter) $onPassCounter.textContent = X;
  $totalAttractions.forEach(el => el.textContent = Y || seenNames.size);
  $daysCounter.forEach(el => el.textContent = A);
  if ($savings && B !== null) $savings.textContent = `$${B}`;
}

/**
 * B = (GoCity Explorer price for X attractions) - ([A]-Day All Inclusive price * adults)
 * Returns null if either pass cannot be found.
 */
function calcB(Passes, tripDays, attractionsOnPass, adults) {
  if (!Passes || !tripDays) return null;

  const passData = Object.entries(Passes);

  // [A]-Day All Inclusive — exact match on trip_days
  const allIncPasses = passData
    .filter(([id, p]) => p.pass_id?.includes('gocity_allinc'))
    .sort((a, b) => Number(a[1].trip_days) - Number(b[1].trip_days));

  const exactAllInc = allIncPasses.find(([id, p]) => Number(p.trip_days) === tripDays);
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

  const B = explorerPrice - (allIncPrice * adults);
  return B > 0 ? B : 0;
}

initPage2();
