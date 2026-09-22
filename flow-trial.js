const $hotel = document.querySelector('[data-ak="hotel-name"]');
const $lastName = document.querySelector('[data-ak="last-name"]');
const $travelDates = document.querySelector('[data-ak="user-travel-dates"]');
const $submitBtn = document.querySelector('[data-ak="submit"]');

const hotelMap = {
    'carlton': '/carlton-arms',
    'compton': '/compton',
    'demo': '/demo-hotel/trip-planner',
};

const defaultRedirect = '/demo-hotel/trip-planner';
let redirect = defaultRedirect;

$hotel.addEventListener('change', e => {
    const val = $hotel.value.trim().toLowerCase();
    if (val.includes('carlton')) {
        redirect = hotelMap['carlton'];
    }
    else if (val.includes('compton')) {
        redirect = hotelMap['compton'];
    }
    else {
        redirect = defaultRedirect;
    }

    console.log('hotel', val)
    console.log('redirect', redirect)
});




$submitBtn.addEventListener('click', e => {
    e.preventDefault();

    if ($hotel.value.trim() === '') {
        highlight($hotel);
    }
    else {
        window.location.href = redirect;
    }
    console.log('Clicked!!')
});

function highlight(el) {
    el.classList.add('highlight');
    setTimeout(()=>el.classList.remove('highlight'),2000);
}
