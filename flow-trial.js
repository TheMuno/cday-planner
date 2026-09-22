const $hotel = document.querySelector('[data-ak="hotel-name"]');
const $lastName = document.querySelector('[data-ak="last-name"]');
const $travelDates = document.querySelector('[data-ak="user-travel-dates"]')?.nextElementSibling;
const $submitBtn = document.querySelector('[data-ak="submit"]');
const $userDataFields = document.querySelectorAll('[data-ak-user-info]');
// $submitBtn is an <input type="submit"> -- a void element with no children, so it can't hold
// a spinner via innerHTML. Its text lives in .value instead, and the spinner has to be a sibling
// element positioned over it rather than content inside it.
const submitBtnOriginalValue = $submitBtn?.value;

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

// Wraps $submitBtn in a relatively-positioned span (once) so the spinner has something to
// absolutely-position itself against, without disturbing the input's own layout/classes.
function ensureSubmitBtnWrap() {
    if (!$submitBtn) return null;
    if ($submitBtn.parentElement?.classList.contains('ak-flow-trial-btn-wrap')) {
        return $submitBtn.parentElement;
    }
    const $wrap = document.createElement('span');
    $wrap.className = 'ak-flow-trial-btn-wrap';
    $wrap.style.cssText = 'position:relative; display:inline-block;';
    $submitBtn.parentNode.insertBefore($wrap, $submitBtn);
    $wrap.appendChild($submitBtn);
    return $wrap;
}

function resetSubmitBtn() {
    if (!$submitBtn) return;
    $submitBtn.classList.remove('ak-saving');
    $submitBtn.disabled = false;
    $submitBtn.style.opacity = '';
    $submitBtn.style.width = '';
    $submitBtn.value = submitBtnOriginalValue;
    $submitBtn.parentElement?.querySelector('.ak-flow-trial-spinner')?.remove();
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
                position: absolute; top: 50%; right: 14px; transform: translateY(-50%);
                width: 14px; height: 14px;
                border: 2px solid currentColor; border-top-color: transparent;
                border-radius: 50%; animation: ak-flow-trial-spin 0.7s linear infinite;
                opacity: 0.85; pointer-events: none;
            }
        `;
        document.head.appendChild(style);
    }

    const $wrap = ensureSubmitBtnWrap();
    $submitBtn.style.width = `${$submitBtn.getBoundingClientRect().width}px`;
    $submitBtn.value = 'Processing...';
    $submitBtn.classList.add('ak-saving');
    $submitBtn.disabled = true;
    $submitBtn.style.opacity = '0.8';
    const $spinner = document.createElement('span');
    $spinner.className = 'ak-flow-trial-spinner';
    $wrap.appendChild($spinner);

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
