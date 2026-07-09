const MAKE_WEBHOOK_URL = 'https://hook.us1.make.com/z0fx4wnlhhmdemvkvyic15xkleyd02um';

sendUserDataOnVisit();

function sendUserDataOnVisit() {
  const email = localStorage.getItem('ak-userMail') || '';

  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');
  const conf = params.get('conf');

  fetch(MAKE_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref, conf, email }),
  }).catch(err => console.error('Failed to send data to Make.com:', err));
}
