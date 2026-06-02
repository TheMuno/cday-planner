const $attractionsWrap = document.querySelector('[data-ak="attractions-wrap"]');

restoreSavedSelections();

function restoreSavedSelections() {
  const saved = localStorage['ak-attractions-saved'];
  if (!saved) return;
  const attractions = JSON.parse(saved)?.slide1?.attractions || [];
  const savedNames = new Set(attractions.map(a => a.displayName.toLowerCase().trim()));

  let anyChecked = false;
  $attractionsWrap?.querySelectorAll('input[type="checkbox"]').forEach($input => {
    const name = ($input.getAttribute('data-name') || '').toLowerCase().trim();
    if (!savedNames.has(name)) return;
    $input.checked = true;
    $input.closest('label')?.querySelector('.w-checkbox-input')?.classList.add('w--redirected-checked');
    anyChecked = true;
  });

  if (anyChecked) document.querySelector('[data-ak="attractions"] .formicon_wrap')?.click();
}

if ($attractionsWrap) {
  $attractionsWrap.addEventListener('change', e => {
    const $checkbox = e.target.closest('input[type="checkbox"]');
    if (!$checkbox) return;
    saveSelectedAttractions();
  });
}

function saveSelectedAttractions() {
  const checked = [...$attractionsWrap.querySelectorAll('input[type="checkbox"]:checked')];

  const attractions = checked.map($input => {
    const $label = $input.closest('label');
    const displayName = $input.getAttribute('data-name') || $input.name.replace(/-/g, ' ');
    const coordsRaw = $label?.getAttribute('coordinates') || '';
    const [latStr, lngStr] = coordsRaw.split(',');
    const lat = parseFloat(latStr?.trim());
    const lng = parseFloat(lngStr?.trim());
    const location = (isNaN(lat) || isNaN(lng)) ? null : { lat, lng };

    return {
      location,
      displayName,
      neighborhood: '',
      address: '',
      editorialSummary: null,
      type: ['tourist_attraction'],
      placeId: '',
      rating: null,
      website: '',
      phone: '',
      reviewCount: null,
      photoUrl: '',
    };
  });

  const savedAttractions = {
    slide1: {
      attractions,
      restaurants: [],
      notes: [],
    }
  };

  localStorage['ak-attractions-saved'] = JSON.stringify(savedAttractions);
  localStorage['ak-update-attractions'] = true;
}
