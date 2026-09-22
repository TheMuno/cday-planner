const $hotel = document.querySelector('[data-ak="hotel-name"]');
const $lastName = document.querySelector('[data-ak="last-name"]');
const $travelDates = document.querySelector('[data-ak="user-travel-dates"]')?.nextElementSibling;
const $submitBtn = document.querySelector('[data-ak="submit"]');
const $userDataFields = document.querySelectorAll('[data-ak-user-info]');

const SAVE_HOTEL_CONF_URL = 'https://us-central1-askkhonsu-map.cloudfunctions.net/saveHotelConf';

// `tag` must match a key in HOTEL_CONF_SPREADSHEET_OVERRIDES (functions/index.js) to route the
// row to that hotel's own sheet -- any other tag (or null) falls back to the default sheet.
const hotelMap = {
    'carlton': { redirect: '/carlton-arms', tag: 'carlton-arms' },
    'compton': { redirect: '/compton', tag: 'compton-bentonville' },
    'demo': { redirect: '/demo-hotel/trip-planner', tag: null },
};

const defaultRedirect = '/demo-hotel/trip-planner';
let redirect = defaultRedirect;

function resolveHotel() {
    const val = $hotel.value.trim().toLowerCase();
    if (val.includes('carlton')) return hotelMap['carlton'];
    if (val.includes('compton')) return hotelMap['compton'];
    return { redirect: defaultRedirect, tag: null };
}

$hotel.addEventListener('change', e => {
    redirect = resolveHotel().redirect;
});

$submitBtn.addEventListener('click', async e => {
    e.preventDefault();

    const emptyUserDataFields = [...$userDataFields].filter(el => !el.value.trim());
    if (emptyUserDataFields.length !== 0) {
        const emptyField = emptyUserDataFields[0];
        if (emptyField.getAttribute('data-ak') === 'user-travel-dates') {
            highlight(emptyField.nextElementSibling);
        }
        else {
            highlight(emptyField);
        }
        return;
    }

    await saveUserData();
    window.location.href = redirect;
});

function highlight(el) {
    el.classList.add('highlight');
    setTimeout(()=>el.classList.remove('highlight'),2000);
}

async function saveUserData() {
    const { tag } = resolveHotel();
    if (!tag) return; // unrecognized/demo hotel -- no dedicated sheet to save to

    const data = { hotel: $hotel.value.trim() };
    $userDataFields.forEach(el => {
        const key = el.getAttribute('data-ak') || el.getAttribute('data-ak-user-info');
        data[key] = el.value.trim();
    });

    try {
        await fetch(SAVE_HOTEL_CONF_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                hotel: tag,
                conf: JSON.stringify(data),
            }),
        });
    } catch (err) {
        console.error('Failed to save hotel confirmation:', err);
    }
}
