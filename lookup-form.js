// Validation for the reservation look-up form (wf-form-Form-Look-up). "Customize now" checks that
// hotel, reservation number, guest last name and number of guests are all filled in; each empty
// one gets data-ak-invalid (styled by the page's <head> CSS) and its red hint shown, and the click
// is stopped. Both clear as soon as the guest fills that field in. All filled in -> the button's
// own href goes through as normal.

const $lookupForm = document.querySelector('#wf-form-Form-Look-up');

// Reservation number and number of guests share the same id/name in Webflow, so fields are looked
// up by a data-ak attribute when present, and otherwise by the label text above them.
function findFieldByLabel(labelText) {
  const $label = [...$lookupForm.querySelectorAll('.u-width-full p')]
    .find($p => $p.textContent.trim().toLowerCase() === labelText.toLowerCase());
  return $label?.closest('.u-width-full')?.querySelector('input:not(.hide), select') || null;
}

const lookupFields = $lookupForm ? [
  $lookupForm.querySelector('[data-ak="hotel-name"]') || findFieldByLabel('Hotel'),
  $lookupForm.querySelector('[data-ak="reservation-num"]') || findFieldByLabel('Reservation number'),
  $lookupForm.querySelector('[data-ak="last-name"]') || findFieldByLabel('Guest last name'),
  $lookupForm.querySelector('[data-ak="guest-count"]') || findFieldByLabel('Number of guests'),
].filter(Boolean) : [];

// The red hint under a field (a [data-ak-hidden] block holding .u-text-color-red), if it has one.
function getErrorHint($field) {
  return [...$field.closest('.u-width-full')?.querySelectorAll('[data-ak-hidden]') || []]
    .find($el => $el.querySelector('.u-text-color-red')) || null;
}

function setFieldInvalid($field, invalid) {
  const $hint = getErrorHint($field);
  if (invalid) {
    $field.setAttribute('data-ak-invalid', 'true');
    $hint?.removeAttribute('data-ak-hidden');
  } else {
    $field.removeAttribute('data-ak-invalid');
    $hint?.setAttribute('data-ak-hidden', 'true');
  }
}

function validateLookupForm() {
  const emptyFields = lookupFields.filter($field => !$field.value.trim());
  lookupFields.forEach($field => setFieldInvalid($field, emptyFields.includes($field)));
  emptyFields[0]?.focus();
  return emptyFields.length === 0;
}

lookupFields.forEach($field => {
  const clearIfFilled = () => {
    if ($field.value.trim()) setFieldInvalid($field, false);
  };
  $field.addEventListener('input', clearIfFilled);
  $field.addEventListener('change', clearIfFilled);
});

// Both "Customize now" and "Can't find your reservation" are data-ak="continue-to-itinerary" --
// only "Customize now" (not the .is-text link) should be blocked by validation.
const $customizeBtn = $lookupForm?.querySelector('[data-ak="customize-now"]')
  || $lookupForm?.querySelector('[data-ak="continue-to-itinerary"]:not(.is-text)');

$customizeBtn?.addEventListener('click', e => {
  if (!validateLookupForm()) e.preventDefault();
});

// Enter in a field submits the Webflow form directly, skipping the button -- route it through
// the same check, then on to the button's href.
$lookupForm?.addEventListener('submit', e => {
  e.preventDefault();
  e.stopImmediatePropagation();
  if (!validateLookupForm()) return;
  const href = $customizeBtn?.getAttribute('href');
  if (href && href !== '#') window.location.href = href;
}, true);
