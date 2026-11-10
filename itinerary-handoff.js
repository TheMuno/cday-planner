// Load in the Khonsu /stay/itinerary page's <head>, as a plain script (no
// async, defer or type="module"), so it runs before stay-itinerary.js:
//   <script src="https://cdn.jsdelivr.net/gh/TheMuno/cday-planner@<commit>/itinerary-handoff.js"></script>
//
// The hotel widget sends guests to /stay/itinerary?hotel=…&res=…&dates=…&token=…&from=…
// This copies those values into the same localStorage keys the lookup form
// saves, so the page shows the right hotel name, image and dates, then tidies
// them out of the address bar. The token is kept for sign-in.
//
// "from" is the page the guest filled the widget in on. The "Go back" button
// (the link inside data-ak="back-to-landingpage") is pointed there for the rest
// of the visit in that tab; anyone who didn't come from a widget keeps the link
// set in Webflow.
(function () {
  var q = new URLSearchParams(location.search);
  var hotel = q.get('hotel');
  var BACK = 'ak-back-url';

  function pointBackButton() {
    var back;
    try { back = sessionStorage.getItem(BACK); } catch (e) {}
    if (!back) return;
    var links = document.querySelectorAll('[data-ak="back-to-landingpage"] a, a.is-back');
    Array.prototype.forEach.call(links, function (a) { a.href = back; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pointBackButton);
  else pointBackButton();

  if (!hotel || !/^[a-z0-9-]{1,64}$/.test(hotel)) return;
  var res = (q.get('res') || '').slice(0, 64);
  var dates = q.get('dates') || '';
  var from = q.get('from') || '';
  try {
    // Only web addresses, and not this page itself.
    var fromUrl = /^https?:\/\//.test(from) ? new URL(from) : null;
    if (fromUrl && fromUrl.origin + fromUrl.pathname !== location.origin + location.pathname) sessionStorage.setItem(BACK, fromUrl.href);
    else sessionStorage.removeItem(BACK);
  } catch (e) {}
  try {
    ['ak-hotel-referral', 'ak-flow-trial-hotel', 'ak-stay-hotel'].forEach(function (k) { localStorage.setItem(k, hotel); });
    ['ak-flow-trial-reservation', 'ak-stay-reservation'].forEach(function (k) { localStorage.setItem(k, res); });
    if (/^\d{4}-\d{2}-\d{2} to \d{4}-\d{2}-\d{2}$/.test(dates)) {
      // Also as the page's date picker shows them ("Tue Dec 01 to Fri Dec 04"): the
      // page's own date code reads both and fails without this one. The time makes
      // the pages read them as local dates, as the picker saves them; without it they're
      // read as London's, a day early in the US.
      var shown = dates.split(' to ').map(function (d) {
        var p = d.split('-');
        return new Date(+p[0], p[1] - 1, +p[2]).toDateString().substring(0, 10);
      }).join(' to ');
      localStorage.setItem('ak-travel-days', JSON.stringify({ flatpickrDate: dates.replace(/(\d{4}-\d{2}-\d{2})/g, '$1T00:00:00'), usrInpDate: shown, dateStr: dates }));
    }
    // Signing in sends this token to the widget server, which adds the
    // account's email to the guest's details (firebase-auth.js).
    localStorage.setItem('ak-stay-token', (q.get('token') || '').slice(0, 1024));
  } catch (e) {}
  ['hotel', 'res', 'dates', 'token', 'from'].forEach(function (k) { q.delete(k); });
  history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);
})();
