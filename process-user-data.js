const MAKE_WEBHOOK_URL = 'https://hook.us1.make.com/z0fx4wnlhhmdemvkvyic15xkleyd02um';

sendTrackingDataToMake();

function sendTrackingDataToMake() {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');
  const conf = params.get('conf');

  if (!ref && !conf) {
    console.log('No ref or conf value');
    return;
  }

  fetch(MAKE_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref, conf }),
  }).catch(err => console.error('Failed to send data to Make.com:', err));
}
