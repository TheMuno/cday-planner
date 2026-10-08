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

  let lastSent = null;

  function sendReport() {
    const nameInput = $('[data-ak="name"]');
    const emailInput = $('[data-ak="email"]');
    if (!nameInput || !emailInput) return;

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    // Mirror the browser validation Webflow relies on, so we only fire when the form will submit.
    if (!name || !email || !nameInput.checkValidity() || !emailInput.checkValidity()) return;

    const payload = { name, email, inputs: getCalcInputs() };
    const key = JSON.stringify(payload);
    if (key === lastSent) return; // double-click / Enter + click
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
  }

  function init() {
    const submitBtn = $('[data-ak="submit-user-info"]');
    if (!submitBtn) return;
    submitBtn.addEventListener('click', sendReport);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
