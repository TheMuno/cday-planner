const MAKE_WEBHOOK_URL = 'https://hook.us1.make.com/z0fx4wnlhhmdemvkvyic15xkleyd02um';

sendTrackingDataToMake();
saveUserDataOnSubmit();

function sendTrackingDataToMake() {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');
  const conf = params.get('conf');
  const name = sessionStorage.getItem('user-smart-name') || '';
  const email = sessionStorage.getItem('user-smart-email') || '';

  if (!ref && !conf && !name && !email) {
    console.log('No ref, conf, name, or email value');
    return;
  }

  fetch(MAKE_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref, conf, name, email }),
  }).catch(err => console.error('Failed to send data to Make.com:', err));
}

function saveUserDataOnSubmit() {
  const $form = document.querySelector('[data-ak="get-user-data"]');
  if (!$form) return;

  $form.addEventListener('submit', () => {
    const name = $form.querySelector('[name="user-smart-name"]')?.value || '';
    const email = $form.querySelector('[name="user-smart-email"]')?.value || '';

    sessionStorage.setItem('user-smart-name', name);
    sessionStorage.setItem('user-smart-email', email);
  });
}
