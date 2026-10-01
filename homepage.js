// Homepage (home-new-hero) script -- also replaces what used to be the page's own Webflow custom
// code (continue-to-itinerary date check + the family/hotel toggle). Loaded as a module, so it runs
// once the HTML is parsed; nothing here depends on flatpickr having initialised yet (date fields
// are only read at click time).

// The travel-dates field the guest actually sees in a form. flatpickr (altInput: true, set up by the
// site-wide code) hides [data-ak="user-travel-dates"] and puts the visible input right after it.
// Some forms have more than one date field (a hidden .hide row), so prefer the one that's visible.
function getVisibleDateField($form) {
  const fields = [...($form?.querySelectorAll('[data-ak="user-travel-dates"]') || [])]
    .map($dates => ($dates.nextElementSibling?.tagName === 'INPUT' ? $dates.nextElementSibling : $dates));
  return fields.find($f => $f.offsetParent !== null) || fields[0] || null;
}

// Flags an empty date field with data-ak-invalid (styled by the page's <head> CSS, same as
// lookup-form.js) for 2s. A repeat click restarts the 2s instead of stacking timers. Used instead
// of the old .highlight class because the head CSS only styles .is_dates.highlight, and the mobile
// forms' date fields don't have .is_dates -- so .highlight showed nothing there.
function flashInvalid($field) {
  $field.setAttribute('data-ak-invalid', 'true');
  clearTimeout($field.akInvalidTimer);
  $field.akInvalidTimer = setTimeout(() => $field.removeAttribute('data-ak-invalid'), 2000);
}

// Both "Customize now" buttons -- hotel tab (continue-to-partner-hotel) and family tab /
// mobile forms (continue-to-itinerary, moved from the page custom code) -- only go to their href
// once travel dates are set. The old continue-to-itinerary code looked the date field up with
// `input.is_dates:not(.flatpickr-input)`, which missed the field entirely in forms without that
// class (the click then threw and the button did nothing) and picked a hidden duplicate in others.
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

// Family / hotel toggle (moved from the page custom code). Starts on whichever toggle has
// is-active in Webflow, falling back to the first.
!function setupTravelToggle() {
  const pairs = [
    ['.travel_toggle_item.is-family', '.travel_item.is-family-content'],
    ['.travel_toggle_item.is-hotel', '.travel_item.is-hotel-content'],
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
