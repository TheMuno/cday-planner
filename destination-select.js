const $attractionsWrap = document.querySelector('[data-ak="attractions-wrap"]');

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
