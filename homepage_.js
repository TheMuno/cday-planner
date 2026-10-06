// Homepage (/) script -- homepage.js adapted to the homepage's markup. Replaces the page's own
// Webflow custom code for the continue-to-itinerary date check, and adds the family/hotel toggle.
// Loaded as a module, so it runs once the HTML is parsed; nothing here depends on flatpickr having
// initialised yet (date fields are only read at click time).
//
// Differences from homepage.js:
// - The homepage's toggles are .travel_toggle_item-4 (a Webflow combo duplicate), not
//   .travel_toggle_item, so they're found by their data-ak attributes instead of the class.
// - The homepage <head> has none of home-new-hero's toggle / data-ak-invalid CSS, so it's
//   injected here. Adding the same rules to the page <head> as well avoids both panels showing
//   for a moment before this module runs.

!function injectStyles() {
  if (document.getElementById('ak-homepage-styles')) return;
  const $style = document.createElement('style');
  $style.id = 'ak-homepage-styles';
  $style.textContent = `
    [data-ak="build-on-my-own"],
    [data-ak="stay-at-partner-hotel"] {
      cursor: pointer;
      transition: background-color .2s, color .2s;
    }
    [data-ak="build-on-my-own"].is-active,
    [data-ak="stay-at-partner-hotel"].is-active {
      background-color: #000;
      color: #fff;
    }
    .travel_item:not(.is-active) {
      display: none;
    }
    [data-ak-invalid] {
      border-color: #e5484d !important;
      box-shadow: inset 0 -1px 0 #e5484d !important;
    }
    .w-input.form-control[data-ak-invalid] {
      box-shadow: none !important;
      outline: 1px solid #e5484d !important;
      outline-offset: 4px;
      border-radius: 4px;
    }
  `;
  document.head.appendChild($style);
}();

// The travel-dates field the guest actually sees in a form. flatpickr (altInput: true, set up by the
// site-wide code) hides [data-ak="user-travel-dates"] and puts the visible input right after it.
// Some forms have more than one date field (a hidden .hide row), so prefer the one that's visible.
function getVisibleDateField($form) {
  const fields = [...($form?.querySelectorAll('[data-ak="user-travel-dates"]') || [])]
    .map($dates => ($dates.nextElementSibling?.tagName === 'INPUT' ? $dates.nextElementSibling : $dates));
  return fields.find($f => $f.offsetParent !== null) || fields[0] || null;
}

// Flags an empty date field with data-ak-invalid (styled above) for 2s. A repeat click restarts
// the 2s instead of stacking timers.
function flashInvalid($field) {
  $field.setAttribute('data-ak-invalid', 'true');
  clearTimeout($field.akInvalidTimer);
  $field.akInvalidTimer = setTimeout(() => $field.removeAttribute('data-ak-invalid'), 2000);
}

// Both "Customize now" buttons -- hotel tab (continue-to-partner-hotel) and family tab /
// mobile forms (continue-to-itinerary) -- only go to their href once travel dates are set.
document.querySelectorAll('[data-ak="continue-to-partner-hotel"], [data-ak="continue-to-itinerary"]').forEach($btn => {
  $btn.addEventListener('click', e => {
    e.preventDefault();

    const $dateField = getVisibleDateField($btn.closest('form'));
    if ($dateField && !$dateField.value.trim()) {
      flashInvalid($dateField);
      return;
    }

    const href = $btn.getAttribute('href');
    if (href && href !== '#') window.location.href = href;
  });
});

// Family / hotel toggle. Starts on whichever toggle has is-active in Webflow, falling back to the
// first.
!function setupTravelToggle() {
  const pairs = [
    ['[data-ak="build-on-my-own"]', '.travel_item.is-family-content'],
    ['[data-ak="stay-at-partner-hotel"]', '.travel_item.is-hotel-content'],
  ]
    .map(([t, c]) => ({ toggle: document.querySelector(t), content: document.querySelector(c) }))
    .filter(p => p.toggle && p.content);
  if (!pairs.length) return;

  function activate(active) {
    pairs.forEach(p => {
      const on = p === active;
      p.toggle.classList.toggle('is-active', on);
      p.content.classList.toggle('is-active', on);
    });
  }

  pairs.forEach(p => p.toggle.addEventListener('click', () => activate(p)));
  activate(pairs.find(p => p.toggle.classList.contains('is-active')) || pairs[0]);
}();
