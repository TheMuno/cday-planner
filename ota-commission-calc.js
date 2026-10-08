// OTA Commission Calculator -> emailed "Revenue Leakage Brief" PDF.
// On [data-ak="submit-user-info"] click (once [data-ak="name"] + [data-ak="email"] are valid),
// posts the visitor's name/email and the calculator's slider values to the
// generateOtaCommissionReport Cloud Function, which renders the PDF and emails it via Make.
// Webflow's own form submission is left untouched -- this runs alongside it.
(function () {
  const REPORT_ENDPOINT = 'https://us-central1-askkhonsu-map.cloudfunctions.net/generateOtaCommissionReport';

  const $ = sel => document.querySelector(sel);

  // Read straight from the sliders rather than the calculator's hidden form fields: its
  // syncForm() falls back to the first .w-form on the page, which isn't the submit-user-info form.
  function getCalcInputs() {
    const inputs = {};
    document.querySelectorAll('#khonsu-calc input[data-k]').forEach(i => {
      inputs[i.dataset.k] = Number(i.value);
    });
    return inputs;
  }

  const SUBMITTED_TEXT = '✓ Submitted!';
  const SUBMITTED_MS = 3000;

  // Works for Webflow's <input type="submit"> as well as a <button>.
  const getLabel = btn => (btn.tagName === 'INPUT' ? btn.value : btn.textContent);
  const setLabel = (btn, text) => { if (btn.tagName === 'INPUT') btn.value = text; else btn.textContent = text; };

  let restoreTimer = null;

  function showSubmitted(btn, originalLabel) {
    setLabel(btn, SUBMITTED_TEXT);
    clearTimeout(restoreTimer);
    restoreTimer = setTimeout(() => setLabel(btn, originalLabel), SUBMITTED_MS);
  }

  let lastSent = null;

  // Returns true when the name/email are valid (i.e. the form is actually submitting).
  function sendReport() {
    const nameInput = $('[data-ak="name"]');
    const emailInput = $('[data-ak="email"]');
    if (!nameInput || !emailInput) return false;

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    // Mirror the browser validation Webflow relies on, so we only fire when the form will submit.
    if (!name || !email || !nameInput.checkValidity() || !emailInput.checkValidity()) return false;

    const payload = { name, email, inputs: getCalcInputs() };
    const key = JSON.stringify(payload);
    if (key === lastSent) return true; // double-click / Enter + click
    lastSent = key;

    // keepalive so the request survives if Webflow redirects after submit.
    fetch(REPORT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: key,
      keepalive: true,
    })
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); })
      .catch(err => {
        lastSent = null; // allow a retry
        console.error('OTA report request failed:', err);
      });
    return true;
  }

  function init() {
    const submitBtn = $('[data-ak="submit-user-info"]');
    if (!submitBtn) return;

    const originalLabel = getLabel(submitBtn);
    // Webflow swaps the label with data-wait ("Please wait...") during its submit and swaps it
    // back afterwards, which would clobber the "Submitted!" state -- take over the label instead.
    submitBtn.removeAttribute('data-wait');

    submitBtn.addEventListener('click', () => {
      if (sendReport()) showSubmitted(submitBtn, originalLabel);
    });

    keepFormVisibleOnSuccess(submitBtn);
  }

  // On success Webflow hides the form and shows its "Thank you! Your submission has been
  // received!" block (.w-form-done). Undo that as soon as it happens so the button's
  // "Submitted!" state is what the visitor sees instead.
  function keepFormVisibleOnSuccess(submitBtn) {
    const form = submitBtn.closest('form');
    const done = form && form.parentElement.querySelector('.w-form-done');
    if (!done) return;

    new MutationObserver(() => {
      if (done.style.display === 'none') return;
      done.style.display = 'none';
      form.style.display = '';
    }).observe(done, { attributes: true, attributeFilter: ['style'] });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
