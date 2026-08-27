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

const firebaseUrl = 'https://getspreadsheetdata-qqhcjhxuda-uc.a.run.app';

const $tripHeadingLine = document.querySelector('[data-ak="trip-heading"]');
const $tripDateLine = document.querySelector('[data-ak="trip-heading-date"]');
const $attractionsOnPasses = document.querySelector('[data-ak="attractions-on-passes"]');

function hasStoredPlaceIds() {
  try {
    return JSON.parse(localStorage['ak-place-ids'] || '[]').length > 0;
  } catch (e) {
    return false;
  }
}

// Fallback: recover ak-place-ids from ak-attractions-saved when it's missing or stuck empty
// (mirrors customize-itinerary_dev_pg2.js) — on-pass-tickets matching depends entirely on ak-place-ids.
if (!hasStoredPlaceIds() && localStorage['ak-attractions-saved']) {
  try {
    const saved = JSON.parse(localStorage['ak-attractions-saved']);
    const placeIds = [];
    Object.values(saved).forEach(day => {
      [...(day.attractions || []), ...(day.restaurants || []), ...(day.notes || [])].forEach(attr => {
        if (attr?.placeId && !placeIds.includes(attr.placeId)) placeIds.push(attr.placeId);
      });
    });
    if (placeIds.length) localStorage['ak-place-ids'] = JSON.stringify(placeIds);
  } catch (_) {}
}

// A purchased user with nothing added on step 1 has nothing for this page to calculate — send
// them back to step 1 (mirrors customize-itinerary_dev_pg2.js's "No attractions added" redirect).
// Not-purchased users always stay, regardless of attractions.
function noAttractionsAdded() {
  return !localStorage['ak-place-ids'] && !localStorage['ak-attractions-saved'];
}

// Derives a sibling page URL from this page's own URL instead of hardcoding the folder prefix —
// e.g. on "/xyz/pass-calculator" this resolves 'itinerary' to "/xyz/itinerary", so it keeps
// working no matter what that prefix is or if it ever changes.
function siblingPagePath(targetSlug) {
  const segments = window.location.pathname.split('/').filter(Boolean);
  segments[segments.length - 1] = targetSlug;
  return '/' + segments.join('/');
}

function redirectToStep1(message) {
  showRedirectLoader(message);
  setTimeout(() => { window.location.href = siblingPagePath('itinerary'); }, 1500);
}

// Shared with stripe-purchase.js: attractions-on-passes and buy-plan each run their own async
// check, but should appear together — whichever finishes last reveals both. Keys for parts not
// present on the current page are dropped immediately so the other party never waits on them.
function akRegisterReveal(key, reveal) {
  const sync = window.akRevealSync || (window.akRevealSync = { pending: new Set(['attractions', 'buyPlan']), reveals: {}, fired: false });
  // Already revealed once — just run this one's own update, don't re-queue and re-fire the
  // other party's stale callback.
  if (sync.fired) { reveal(); return; }
  if (!document.querySelector('[data-ak="attractions-on-passes"]')) sync.pending.delete('attractions');
  if (!document.querySelector('[data-ak="buy-plan"]')) sync.pending.delete('buyPlan');
  sync.reveals[key] = reveal;
  sync.pending.delete(key);
  if (sync.pending.size === 0) {
    sync.fired = true;
    Object.values(sync.reveals).forEach(fn => fn());
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // Neither the date line, the trip name, nor the on-pass ticket count/sheet fetch depends on
  // auth — start them immediately instead of waiting on the auth round-trip below.
  restoreTripDateLine();
  $tripDateLine?.removeAttribute('data-ak-skeleton-pulse');
  restoreTripHeadingName();

  // X (on-pass-tickets) must land first; Y (init-tickets-num) only renders once that settles —
  // .finally() so Y still shows up even if the sheet fetch fails.
  populateOnPassTickets().catch(err => {
    console.error(err);
    // Fail-safe: X couldn't be computed (e.g. sheet fetch failed) before the reveal below ever
    // ran, so register a no-op here — otherwise buy-plan would wait forever for this key.
    if ($attractionsOnPasses) akRegisterReveal('attractions', () => {});
  }).finally(() => {
    renderInitTickets();
  });

  // Not-logged-in takes priority over everything else on this page — checked first, before any
  // other wiring or the purchased/attractions check below (which would otherwise be able to fire
  // off a stale cached purchase value ahead of confirming the user is even signed in).
  const user = await new Promise(resolve => onAuthStateChanged(auth, resolve));
  if (!user) {
    redirectToStep1('User not logged in');
    return;
  }

  if (localStorage['ak-has-purchased-plan'] === 'true') {
    if (noAttractionsAdded()) { redirectToStep1('No attractions added'); return; }
  } else {
    // Cached value isn't confirmed purchased yet — listen for stripe-purchase.js's live check
    // on this page load in case it resolves to purchased while the user is still here.
    window.addEventListener('ak:purchase-status', e => {
      if (e.detail?.purchased && noAttractionsAdded()) redirectToStep1('No attractions added');
    }, { once: true });
  }

  document.querySelector('[data-ak="continue-to-step3"]')?.addEventListener('click', e => {
    e.preventDefault();
    window.location.href = siblingPagePath('verify-itinerary');
  });

  document.querySelectorAll('[data-ak="scroll-to-buy-btn"]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      const $buyPlan = document.querySelector('[data-ak="buy-plan"]');
      $buyPlan?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      $buyPlan?.classList.add('active');
      setTimeout(() => $buyPlan?.classList.remove('active'), 1500);
    });
  });

  ['purchase-go-city', 'purchase-city-pass'].forEach(dataAk => {
    document.querySelector(`[data-ak="${dataAk}"]`)?.addEventListener('click', e => {
      const url = e.currentTarget.dataset.akPurchaseLink;
      if (!url) return;
      e.preventDefault();
      window.open(url, '_blank', 'noopener');
    });
  });

  restoreTripHeadingName(user);
});

// Mirrors customize-itinerary_dev_pg2.js's showRedirectLoader().
function showRedirectLoader(message) {
  if (!document.getElementById('pcs-spinner-style')) {
    const style = document.createElement('style');
    style.id = 'pcs-spinner-style';
    style.textContent = "@keyframes pcs-spin { to { transform: rotate(360deg); } }";
    document.head.appendChild(style);
  }
  const overlay = document.createElement('div');
  overlay.id = 'pcs-loader-overlay';
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
    borderRadius: '50%', animation: 'pcs-spin 0.7s linear infinite',
  });
  overlay.appendChild(spinner);
  document.body.appendChild(overlay);
}

// Attractions/Passes sheet data barely changes and step1->2->3 of the funnel can all fetch it
// within the same sitting, so cache it in sessionStorage for a short window instead of re-hitting
// the (slow, cold-start-prone) Cloud Run endpoint on every page load. sessionStorage keeps this
// scoped to the current tab session — closing the tab always starts clean.
const SHEET_CACHE_KEY = 'ak-sheet-data-cache';
const SHEET_CACHE_TTL_MS = 10 * 60 * 1000;

async function fetchSheetData() {
  try {
    const cached = JSON.parse(sessionStorage[SHEET_CACHE_KEY] || 'null');
    if (cached && Date.now() - cached.ts < SHEET_CACHE_TTL_MS) return cached.data;
  } catch (_) {}

  const res = await fetch(firebaseUrl);
  const data = await res.json();

  try {
    sessionStorage[SHEET_CACHE_KEY] = JSON.stringify({ data, ts: Date.now() });
  } catch (_) {}

  return data;
}

// build-itinerary.js's continue-to-step2 never sets ak-y-total-attractions (that's only written by
// the old customize-itinerary.js flow), so derive Y from the actual saved itinerary data instead:
// count of "visit" (attractions bucket) locations across all days.
function getTotalAttractionsCount() {
  let saved;
  try {
    saved = JSON.parse(localStorage['ak-attractions-saved'] || '{}');
  } catch (e) {
    return 0;
  }
  return Object.values(saved).reduce((count, slide) => count + (slide.attractions?.length || 0), 0);
}

// Y has no dependency on the sheet fetch, so render it immediately instead of behind it.
function renderInitTickets() {
  const Y = getTotalAttractionsCount();
  document.querySelectorAll('[data-ak="init-tickets-num"]').forEach(el => el.textContent = Y);
}

// Attractions the user actually added, deduped by normalized name — shared by the on-pass
// counter (X) and the packages grid below so both agree on the same matched set.
function getMatchedAttractions(Attractions) {
  if (!Attractions) return [];

  const placeIds = JSON.parse(localStorage['ak-place-ids'] || '[]');
  const userAddedAttractions = Object.entries(JSON.parse(localStorage['ak-user-added-items'] || '{}'));
  const normalize = str => str?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
  const seenNames = new Set();
  const matched = [];

  for (const passInfo of Object.values(Attractions)) {
    const { place_id, place_id_secondary, attraction_name } = passInfo;
    const normalizedName = normalize(attraction_name);

    const isMatchedById = placeIds.includes(place_id) || (place_id_secondary && placeIds.includes(place_id_secondary));
    const isMatchedByName = userAddedAttractions.some(a => a[0].includes(normalizedName));

    if ((!isMatchedById && !isMatchedByName) || seenNames.has(normalizedName)) continue;
    seenNames.add(normalizedName);
    matched.push(passInfo);
  }

  return matched;
}

// Mirrors the X portion of preCalculatePassStats() in customize-itinerary_dev_pg2.js.
// Always writes a value to on-pass-tickets (even 0) instead of bailing out silently, so the
// element never gets stuck on its placeholder markup.
async function populateOnPassTickets() {
  const $onPassCounter = document.querySelector('[data-ak="on-pass-tickets"]');

  const { Attractions, Passes } = await fetchSheetData();
  localStorage['ak-sheet-attractions'] = JSON.stringify(Attractions);

  const matched = getMatchedAttractions(Attractions);
  const X = matched.filter(a => {
    if (a.on_pass?.trim().toLowerCase() !== 'true') return false;
    const passes = a.passes?.toLowerCase() || '';
    return passes.includes('go city') || passes.includes('citypass');
  }).length;

  if ($onPassCounter) $onPassCounter.textContent = X;
  if ($attractionsOnPasses) {
    akRegisterReveal('attractions', () => {
      if (X > 0) $attractionsOnPasses.removeAttribute('data-ak-hidden');
      else $attractionsOnPasses.setAttribute('data-ak-hidden', 'true');
    });
  }

  populatePackagesGrid(matched, Passes);
}

// Best pass covering `targetCount` attractions for a given pass family (gocity_explorer /
// citypass). Mirrors populateGoCityPasses/populateCityPasses + workoutLowerNUpperPass in
// customize-itinerary_dev_pg2.js: an exact attraction_count match (or only one side of the
// range existing) renders as a single price; only when both a cheaper and pricier candidate
// exist with no exact match is it a range.
function resolveBestPass(passData, passIdSubstr, targetCount, extraFilter) {
  let matches = passData.filter(([, p]) => p.pass_id?.includes(passIdSubstr));
  if (extraFilter) matches = matches.filter(extraFilter);
  if (!matches.length) return null;

  const sorted = matches.sort((a, b) => Number(a[1].attraction_count) - Number(b[1].attraction_count));
  const exact = sorted.find(([, p]) => Number(p.attraction_count) === targetCount);
  if (exact) return { shape: 'single', pass: exact[1] };

  const upper = sorted.find(([, p]) => Number(p.attraction_count) >= targetCount);
  const lower = [...sorted].reverse().find(([, p]) => Number(p.attraction_count) <= targetCount);

  if (lower && upper) return { shape: 'range', lower: lower[1], upper: upper[1] };
  if (lower) return { shape: 'single', pass: lower[1] };
  if (upper) return { shape: 'single', pass: upper[1] };
  return null;
}

// Mirrors citypass5EligibilityCheck() in customize-itinerary_dev_pg2.js: C5 tiers require
// Empire State Building or AMNH and exclude Edge/MoMA.
function citypass5EligibilityCheck(cityPassAttractions) {
  const empireStateBuilding = 'ChIJaXQRs6lZwokRY6EFpJnhNNE';
  const amnh = 'ChIJCXoPsPRYwokRsV1MYnKBfaI';
  const edge = 'ChIJ3aqq5Q1ZwokRb9hLO7Gyxgw';
  const moma = 'ChIJKxDbe_lYwokRVf__s8CPn-o';
  let required = 0;
  let excluded = 0;

  for (const { place_id } of cityPassAttractions) {
    if (place_id?.includes(empireStateBuilding) || place_id?.includes(amnh)) required++;
    else if (place_id?.includes(edge) || place_id?.includes(moma)) excluded++;
  }

  return excluded === 0 && required >= 2;
}

// lowerLabel/upperLabel are pass_name values from the internal pricing spreadsheet — escaped
// before going into innerHTML so a stray '<'/'>' in a sheet cell can't be interpreted as markup.
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function renderSinglePriceShape($contain, priceText) {
  $contain.innerHTML = `<div class="u-size-120-64 w-richtext"><p>${priceText}<sub></sub></p></div>`;
}

function renderRangePriceShape($contain, lowerPriceText, lowerLabel, upperPriceText, upperLabel) {
  $contain.innerHTML = `
    <div class="calc_packages_box_inner">
      <div class="u-size-56-28 w-richtext"><p>${lowerPriceText}</p></div>
      <div class="u-body">${escapeHtml(lowerLabel)}</div>
    </div>
    <div class="calc_packages_box_inner">
      <div class="u-size-56-28 w-richtext"><p>${upperPriceText}</p></div>
      <div class="u-body">${escapeHtml(upperLabel)}</div>
    </div>`;
}

function updateBoxContent($box, labelText, savingsText) {
  const $content = $box.querySelector('.calc_packages_box_content');
  if (!$content) return;
  const $labelP = $content.firstElementChild?.querySelector('p');
  const $savingsP = $content.lastElementChild?.querySelector('p');
  if ($labelP) $labelP.textContent = labelText;
  if ($savingsP) $savingsP.textContent = savingsText;
}

// Renders one calc_packages_box_wrap (GoCity or CityPass): single price shape (like GoCity's
// current markup) when one pass matches exactly, or the two-tier range shape (like CityPass's
// current markup) when the best fit falls between two passes. Savings is always figured against
// the Individual column's summed total, using the cheaper tier's price when in range shape.
function updatePassBox($box, $purchaseBtn, result, individualTotal) {
  const $contain = $box.querySelector('.calc_packages_box_contain');
  if (!$contain) return;

  // Single price (including no attractions on this pass at all) -> black background; range ->
  // orange. The purchase button below the box follows the same theme (dark for black, brand
  // for orange).
  const isSingle = !result || result.shape === 'single';
  $box.classList.toggle('is-black', isSingle);
  $box.classList.toggle('is-orange-gdrn', !isSingle);
  if ($purchaseBtn) {
    $purchaseBtn.classList.toggle('is-dark-theme', isSingle);
    $purchaseBtn.classList.toggle('is-brand-theme', !isSingle);
  }

  if (!result) {
    renderSinglePriceShape($contain, '$0');
    updateBoxContent($box, '', 'No attractions on this pass');
    return;
  }

  if (result.shape === 'single') {
    const price = Number(result.pass.pass_price) || 0;
    const savings = Math.max(individualTotal - price, 0);
    renderSinglePriceShape($contain, `$${price}`);
    updateBoxContent($box, result.pass.pass_name || '', `Saves $${savings} vs Individual`);
  } else {
    const lowerPrice = Number(result.lower.pass_price) || 0;
    const upperPrice = Number(result.upper.pass_price) || 0;
    const savings = Math.max(individualTotal - lowerPrice, 0);
    renderRangePriceShape($contain, `$${lowerPrice}`, result.lower.pass_name || '', `$${upperPrice}`, result.upper.pass_name || '');
    updateBoxContent($box, 'Chose your level', `${result.lower.pass_name || ''} saves $${savings} vs Individual`);
  }
}

// pass_id's tier code, stripped of its "gocity"/"citypass" family prefix and cleaned up —
// e.g. "gocity_explorer_7" -> "Explorer 7", "citypass_c3" -> "C3".
function passCodeName(pass) {
  const stripped = (pass.pass_id || '').replace(/^(gocity|citypass)[_\s-]*/i, '');
  const words = stripped.replace(/[_-]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// How a pass result should read outside its own box (e.g. in the attractions table's TOTAL
// row): just the price when single, or "$price - code" (the cheaper tier's code) when a range.
function resultDisplayText(result) {
  if (!result) return '$0';
  const pass = result.shape === 'single' ? result.pass : result.lower;
  const price = Number(pass.pass_price) || 0;
  const code = passCodeName(pass);
  if (result.shape === 'single' || !code) return `$${price}`;
  return `$${price} - ${code}`;
}

// Rebuilds .calc_table_wrap's per-attraction rows from the existing template row (cloned before
// the placeholder rows are removed, so its check/✕ <svg> pair and structure are reused as-is).
// Go City / City Pass cells: check icon + price when the attraction is personally on that pass,
// ✕ icon + no price otherwise. Individual always shows the price, no icons (no on/off state).
function populateAttractionsTable(matched, goCitySet, cityPassSet, totals) {
  const $tableWrap = document.querySelector('[data-ak-post-purchase="true"] .calc_table_wrap');
  if (!$tableWrap) return;

  const $rows = Array.from($tableWrap.querySelectorAll('.calc_table_row'));
  const $headerRow = $rows.find(r => r.classList.contains('is-black'));
  const $totalRow = $rows.find(r => r.classList.contains('is-last'));
  const $templateRow = $rows.find(r => r !== $headerRow && r !== $totalRow);

  if ($totalRow) {
    const $totalCols = $totalRow.querySelectorAll('.calc_table_column');
    const values = [totals.goCity, totals.individual, totals.cityPass];
    $totalCols.forEach(($col, i) => {
      const $h2 = $col.querySelector('h2');
      if ($h2 && values[i] !== undefined) $h2.textContent = values[i];
    });
  }

  if (!$templateRow) return;
  const $template = $templateRow.cloneNode(true);
  $rows.forEach(r => { if (r !== $headerRow && r !== $totalRow) r.remove(); });

  const setPassCell = ($col, isOnPass) => {
    const $check = $col.querySelector('.calc_table_icon.is-check');
    const $cross = Array.from($col.querySelectorAll('.calc_table_icon')).find(el => el !== $check);
    if ($check) $check.style.display = isOnPass ? '' : 'none';
    if ($cross) $cross.style.display = isOnPass ? 'none' : '';
    const $price = $col.querySelector('div');
    if ($price) $price.textContent = '';
  };

  matched.forEach((attr, i) => {
    const $row = $template.cloneNode(true);
    $row.classList.toggle('is-alt', i % 2 === 1);

    const $title = $row.querySelector('.calc_table_title_column .u-body');
    if ($title) $title.textContent = attr.attraction_name || '';

    const cost = Number(attr.cost?.replace(/[^0-9.]/g, '')) || 0;
    const [$goCityCol, $individualCol, $cityPassCol] = $row.querySelectorAll('.calc_table_column');

    if ($goCityCol) setPassCell($goCityCol, goCitySet.has(attr));
    if ($cityPassCol) setPassCell($cityPassCol, cityPassSet.has(attr));

    const $individualPrice = $individualCol?.querySelector('div');
    if ($individualPrice) $individualPrice.textContent = `$${cost}`;

    if ($totalRow) $totalRow.insertAdjacentElement('beforebegin', $row);
    else $tableWrap.appendChild($row);
  });
}

// .calc_packages_grid: Individual sums every matched attraction regardless of pass membership
// (buying each ticket separately); GoCity/CityPass only count attractions personally on that
// pass, then resolve the best-fit pass for that count. Also drives .calc_table_wrap's
// per-attraction breakdown below the grid, from the same matched/pass-result data.
function populatePackagesGrid(matched, Passes) {
  if (!matched.length || !Passes) return;

  const passData = Object.entries(Passes);
  const individualTotal = matched.reduce((sum, a) => sum + (Number(a.cost?.replace(/[^0-9.]/g, '')) || 0), 0);

  const goCityMatched = matched.filter(a => a.on_pass?.trim().toLowerCase() === 'true' && a.passes?.toLowerCase().includes('go city'));
  const goCityResult = goCityMatched.length ? resolveBestPass(passData, 'gocity_explorer', goCityMatched.length) : null;

  const cityPassMatched = matched.filter(a => a.on_pass?.trim().toLowerCase() === 'true' && a.passes?.toLowerCase().includes('citypass'));
  let cityPassResult = null;
  if (cityPassMatched.length) {
    const c5Eligible = citypass5EligibilityCheck(cityPassMatched);
    const filter = c5Eligible ? undefined : ([, p]) => !p.pass_name?.toLowerCase().includes('c5');
    cityPassResult = resolveBestPass(passData, 'citypass', cityPassMatched.length, filter);
  }

  const $grid = document.querySelector('[data-ak-post-purchase="true"] .calc_packages_grid');
  if ($grid) {
    const $goCityBox = $grid.querySelector('.calc_packages_box_wrap.is-black');
    const $individualBox = $grid.querySelector('.calc_packages_box_wrap:not(.is-black):not(.is-orange-gdrn)');
    const $cityPassBox = $grid.querySelector('.calc_packages_box_wrap.is-orange-gdrn');

    if ($individualBox) {
      const $contain = $individualBox.querySelector('.calc_packages_box_contain');
      if ($contain) renderSinglePriceShape($contain, `$${individualTotal}`);
    }
    if ($goCityBox) updatePassBox($goCityBox, document.querySelector('[data-ak="purchase-go-city"]'), goCityResult, individualTotal);
    if ($cityPassBox) updatePassBox($cityPassBox, document.querySelector('[data-ak="purchase-city-pass"]'), cityPassResult, individualTotal);
  }

  populateAttractionsTable(matched, new Set(goCityMatched), new Set(cityPassMatched), {
    individual: `$${individualTotal}`,
    goCity: resultDisplayText(goCityResult),
    cityPass: resultDisplayText(cityPassResult),
  });
}

// Split into two halves so the date line (no auth dependency) can be restored immediately on
// DOMContentLoaded instead of waiting on the Firebase auth round-trip.
//
// Takes `user` as a param instead of reading auth.currentUser so the cached-name case below
// doesn't have to wait on the auth round-trip either — only the displayName/email fallback
// actually needs the Firebase user object, and that's only reached when localStorage has
// nothing yet.
function restoreTripHeadingName(user) {
  const $headingH2 = document.querySelector('[data-ak="trip-heading"] h2');
  if (!$headingH2) return;
  let tripName = localStorage['ak-user-name'] || user?.displayName?.split(/\s+/)[0] || user?.email?.split('@')[0] || '';
  if (!tripName) return;
  tripName = tripName.charAt(0).toUpperCase() + tripName.slice(1).toLowerCase();
  $headingH2.textContent = `${tripName}'s Trip to N.Y.C`;
  $tripHeadingLine?.removeAttribute('data-ak-skeleton-pulse');
}

function restoreTripDateLine() {
  if (!$tripDateLine || !localStorage['ak-travel-days']) return;

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

  const $children = $tripDateLine.children;
  if ($children.length < 2) return;

  const $firstEm = $children[0].querySelector('p em');
  const $lastEm = $children[$children.length - 1].querySelector('p em');
  if ($firstEm) $firstEm.textContent = fmt(new Date(startRaw));
  if ($lastEm) $lastEm.textContent = fmt(new Date(endRaw || startRaw));
}
