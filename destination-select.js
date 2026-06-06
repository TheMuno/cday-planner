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
  const allCheckboxNames = new Set(
    [...$attractionsWrap.querySelectorAll('input[type="checkbox"]')]
      .map($input => ($input.getAttribute('data-name') || $input.name.replace(/-/g, ' ')).toLowerCase().trim())
  );

  const newAttractions = checked.map($input => {
    const $label = $input.closest('label');
    const displayName = $input.getAttribute('data-name') || $input.name.replace(/-/g, ' ');
    const coordsRaw = $label?.getAttribute('coordinates') || '';
    const [latStr, lngStr] = coordsRaw.split(',');
    const lat = parseFloat(latStr?.trim());
    const lng = parseFloat(lngStr?.trim());
    const location = (isNaN(lat) || isNaN(lng)) ? null : { lat, lng };
    const placeId = $input.getAttribute('data-place-id') || $label?.getAttribute('data-place-id') || '';

    return {
      location,
      displayName,
      neighborhood: '',
      address: '',
      editorialSummary: null,
      type: ['tourist_attraction'],
      placeId,
      rating: null,
      website: '',
      phone: '',
      reviewCount: null,
      photoUrl: '',
    };
  });

  const existing = localStorage['ak-attractions-saved'] ? JSON.parse(localStorage['ak-attractions-saved']) : {};
  const existingSlide1 = existing.slide1 || {};
  const existingAttractions = existingSlide1.attractions || [];

  // Preserve attractions added elsewhere (e.g. via autocomplete) that aren't in this page's checkbox set
  const otherAttractions = existingAttractions.filter(
    a => !allCheckboxNames.has(a.displayName.toLowerCase().trim())
  );

  // Merge: others first, then newly checked — deduplicated by displayName
  const combined = [...new Map(
    [...otherAttractions, ...newAttractions].map(a => [a.displayName.toLowerCase().trim(), a])
  ).values()];

  const savedAttractions = {
    ...existing,
    slide1: {
      ...existingSlide1,
      attractions: combined,
      restaurants: existingSlide1.restaurants || [],
      notes: existingSlide1.notes || [],
    }
  };

  localStorage['ak-attractions-saved'] = JSON.stringify(savedAttractions);
  localStorage['ak-update-attractions'] = true;
}
