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

// Tags the sheet write so the backend (functions/index.js's resolveHotelConfSpreadsheetId)
// can route Compton-Bentonville rows to its own sheet instead of the shared default one.
// Same href-substring style as the carlton-arms check in captureHotelReferral() below.
function detectHotelSheetTag() {
  if (window.location.href.includes('compton')) return 'compton-bentonville';
  return null;
}

captureHotelReferral();

// Carlton Arms is checked first, ahead of the generic ?hotel= param, since its demo pages are a
// fixed URL (not driven by a query param) — see the matching carlton-arms checks in
// build-itinerary.js. Every other hotel is onboarded via a link carrying "?hotel=Hotel+Name"
// instead of a dedicated URL/page.
function captureHotelReferral() {
  if (window.location.href.includes('carlton-arms')) {
    localStorage.setItem('ak-hotel-referral', 'carlton-arms');
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
