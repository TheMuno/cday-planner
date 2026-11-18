// Gives .page_main its hotel's class (e.g. is-reluctant) the moment it is parsed, before the first paint,
// so the hotel's colours show straight away instead of waiting for stay-guide.js / stay-verify.js and
// their Firebase imports to download. Load it in the page's <head> as a plain (non-module) script,
// without async or defer, so it runs before <body> is parsed.
// The page scripts still apply the class again, and switch it when the hotel only comes from the saved trip.
// Keep HOTEL_THEME_CLASSES in step with the list in stay-itinerary.js, stay-guide.js and stay-verify.js.
(function () {
  var HOTEL_THEME_CLASSES = {
    'carlton-arms': 'is-carlton',
    compton: 'is-compton',
    'king-frederik-inn': 'is-kfi',
    'reluctant-panther': 'is-reluctant'
  };
  var key;
  try {
    key = localStorage['ak-stay-hotel'] || localStorage['ak-flow-trial-hotel'] || localStorage['ak-hotel-referral'];
  } catch (e) { return; }

  function apply(main) {
    for (var k in HOTEL_THEME_CLASSES) main.classList.toggle(HOTEL_THEME_CLASSES[k], k === key);
    // Lifts loader.css's colour hold; with no saved hotel the page script lifts it once it knows.
    if (key) main.setAttribute('data-ak-theme-ready', 'true');
  }

  var found = document.querySelector('.page_main');
  if (found) return apply(found);
  var obs = new MutationObserver(function () {
    var main = document.querySelector('.page_main');
    if (main) { obs.disconnect(); apply(main); }
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
  // Stop watching once the page is parsed, even if .page_main never shows up.
  document.addEventListener('DOMContentLoaded', function () { obs.disconnect(); });
})();
