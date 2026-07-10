saveUserDataOnVisit();

function saveUserDataOnVisit() {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');
  const conf = params.get('conf');

  if (ref) localStorage['ak-ref'] = ref;
  if (conf) localStorage['ak-conf'] = conf;
}
