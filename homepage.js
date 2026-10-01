// Every [data-ak="continue-to-partner-hotel"] on the page (e.g. separate desktop/mobile buttons)
// sends the guest to its own href -- but only once travel dates are set. An empty date field gets
// data-ak-invalid (styled by the page's <head> CSS, same as lookup-form.js) until dates are picked.
document.querySelectorAll('[data-ak="continue-to-partner-hotel"]').forEach($btn => {
  $btn.addEventListener('click', e => {
    e.preventDefault();

    // flatpickr (altInput: true) turns [data-ak="user-travel-dates"] into a hidden input and puts
    // the visible one right after it -- that's the one the guest sees, so check/highlight it.
    // (Not the page code's `input.is_dates` lookup: the hidden hotel input in this form also has
    // .is_dates and comes first.)
    const $dates = $btn.closest('form')?.querySelector('[data-ak="user-travel-dates"]');
    const $dateField = $dates?.nextElementSibling?.tagName === 'INPUT' ? $dates.nextElementSibling : $dates;
    if ($dateField && !$dateField.value.trim()) {
      $dateField.setAttribute('data-ak-invalid', 'true');
      // flatpickr sets the dates programmatically (no input event on the visible field) but fires
      // `change` on the original input -- clear the highlight then.
      if (!$dates.akInvalidClearWired) {
        $dates.akInvalidClearWired = true;
        $dates.addEventListener('change', () => {
          if ($dateField.value.trim()) $dateField.removeAttribute('data-ak-invalid');
        });
      }
      return;
    }

    const href = $btn.getAttribute('href');
    if (href && href !== '#') window.location.href = href;
  });
});
