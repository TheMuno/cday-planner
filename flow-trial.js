const $hotel = document.querySelector('[data-ak="hotel-name"]');
const $lastName = document.querySelector('[data-ak="last-name"]');
const $travelDates = document.querySelector('[data-ak="user-travel-dates"]')?.nextElementSibling;
const $submitBtn = document.querySelector('[data-ak="submit"]');
const $userDataFields = document.querySelectorAll('[data-ak-user-info]');
const submitBtnOriginalHTML = $submitBtn?.innerHTML;

// Dedicated to this flow-trial form -- routes to its own per-hotel sheet via
// resolveFlowTrialSpreadsheetId() in functions/index.js. Not the same endpoint/sheets used by
// planner.js or firebase-auth.js.
const SAVE_FLOW_TRIAL_URL = 'https://us-central1-askkhonsu-map.cloudfunctions.net/saveFlowTrialSubmission';

// `tag` must match a key in FLOW_TRIAL_SPREADSHEETS (functions/index.js) to route to that
// hotel's own sheet -- anything else falls back to the "demo" sheet server-side.
const hotelMap = {
    'carlton': { redirect: '/carlton-arms/itinerary', tag: 'carlton-arms' },
    'compton': { redirect: '/compton/itinerary', tag: 'compton-bentonville' },
    'demo': { redirect: '/demo-hotel/itinerary', tag: 'demo' },
};

let redirect = hotelMap['demo'].redirect;

function resolveHotel() {
    const val = $hotel.value.trim().toLowerCase();
    if (val.includes('carlton')) return hotelMap['carlton'];
    if (val.includes('compton')) return hotelMap['compton'];
    return hotelMap['demo'];
}

$hotel.addEventListener('change', e => {
    redirect = resolveHotel().redirect;
});

function resetSubmitBtn() {
    if (!$submitBtn) return;
    $submitBtn.classList.remove('ak-saving');
    $submitBtn.disabled = false;
    $submitBtn.style.opacity = '';
    $submitBtn.style.minWidth = '';
    $submitBtn.innerHTML = submitBtnOriginalHTML;
}

// Bfcache restores the page (and its DOM/JS state) exactly as it was when the user navigated
// away, so without this the button can come back stuck mid-spinner if they hit back after
// clicking submit.
window.addEventListener('pageshow', e => {
    if (e.persisted) resetSubmitBtn();
});

$submitBtn.addEventListener('click', async e => {
    e.preventDefault();
    if ($submitBtn.classList.contains('ak-saving')) return;

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

    if (!document.getElementById('ak-flow-trial-spinner-style')) {
        const style = document.createElement('style');
        style.id = 'ak-flow-trial-spinner-style';
        style.textContent = `
            @keyframes ak-flow-trial-spin { to { transform: rotate(360deg); } }
            .ak-flow-trial-spinner {
                display: inline-block; width: 14px; height: 14px;
                border: 2px solid currentColor; border-top-color: transparent;
                border-radius: 50%; animation: ak-flow-trial-spin 0.7s linear infinite;
                opacity: 0.8; flex-shrink: 0;
            }
            .ak-flow-trial-btn-loading { display: inline-flex; align-items: center; gap: 8px; }
        `;
        document.head.appendChild(style);
    }

    $submitBtn.style.minWidth = `${$submitBtn.getBoundingClientRect().width}px`;
    $submitBtn.innerHTML = `<span class="ak-flow-trial-btn-loading"><span class="ak-flow-trial-spinner"></span>Processing...</span>`;
    $submitBtn.classList.add('ak-saving');
    $submitBtn.disabled = true;
    $submitBtn.style.opacity = '0.8';

    // The save is best-effort logging, not a blocking step -- cap how long the spinner waits on
    // it so a slow/dropped request can't strand the user on this page, then redirect regardless.
    const saveTimeout = new Promise(resolve => setTimeout(resolve, 10000));
    await Promise.race([saveUserData(), saveTimeout]);
    window.location.href = redirect;
});

function highlight(el) {
    el.classList.add('highlight');
    setTimeout(()=>el.classList.remove('highlight'),2000);
}

async function saveUserData() {
    const { tag } = resolveHotel();

    const fields = { hotel: $hotel.value.trim() };
    $userDataFields.forEach(el => {
        const key = el.getAttribute('data-ak') || el.getAttribute('data-ak-user-info');
        fields[key] = el.value.trim();
    });

    try {
        const res = await fetch(SAVE_FLOW_TRIAL_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hotel: tag, fields }),
        });
        if (!res.ok) throw new Error(`saveFlowTrialSubmission responded ${res.status}`);
    } catch (err) {
        console.error('Failed to save flow-trial submission:', err);
    }
}
