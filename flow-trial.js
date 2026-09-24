const $hotel = document.querySelector('[data-ak="hotel-name"]');
const $lastName = document.querySelector('[data-ak="last-name"]');
const $travelDates = document.querySelector('[data-ak="user-travel-dates"]')?.nextElementSibling;
const $submitBtn = document.querySelector('[data-ak="submit"]');
const $userDataFields = document.querySelectorAll('[data-ak-user-info]');
// $submitBtn is an <input type="submit"> -- a void element with no children, so it can't hold
// a spinner via innerHTML. Its text lives in .value instead, and the spinner has to be a sibling
// element positioned over it rather than content inside it.
const submitBtnOriginalValue = $submitBtn?.value;
// Captured before anything (including the wrapper below) can touch layout, since $submitBtn's
// own CSS (the "is_100" class) sizes it to 100% of its *original* parent -- measuring later,
// after wrapping, would capture whatever width it collapsed to inside the wrapper instead.
const submitBtnOriginalWidth = $submitBtn?.getBoundingClientRect().width;

// Dedicated to this flow-trial form -- routes to its own per-hotel sheet via
// resolveFlowTrialSpreadsheetId() in functions/index.js. Not the same endpoint/sheets used by
// planner.js or firebase-auth.js.
const SAVE_FLOW_TRIAL_URL = 'https://us-central1-askkhonsu-map.cloudfunctions.net/saveFlowTrialSubmission';

// `tag` must match a key in FLOW_TRIAL_SPREADSHEETS (functions/index.js) to route to that
// hotel's own sheet -- anything else falls back to the "demo" sheet server-side.
// `referral` is saved as ak-hotel-referral on submit, so firebase-auth.js knows which hotel to
// ask about in the opt-in modal -- same keys the hotel pages save (planner.js / cb-planner.js).
const hotelMap = {
    'carlton': { redirect: '/carlton-arms/itinerary', tag: 'carlton-arms', referral: 'carlton-arms' },
    'compton': { redirect: '/compton/itinerary', tag: 'compton-bentonville', referral: 'compton' },
    'demo': { redirect: '/demo-hotel/itinerary', tag: 'demo', referral: 'demo' },
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
    // display:block (not inline-block) so it doesn't shrink to fit its content -- it needs to
    // fill the same space the input did, or the input's width:100% (the "is_100" class)
    // collapses to the wrapper's intrinsic size instead of the original parent's width.
    $wrap.style.cssText = 'position:relative; display:block;';
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
    $submitBtn.style.color = '';
    $submitBtn.value = submitBtnOriginalValue;
    $submitBtn.parentElement?.querySelector('.ak-flow-trial-btn-overlay')?.remove();
}

// Bfcache restores the page (and its DOM/JS state, including our mid-submit mutations) exactly
// as it was when the user navigated away. `event.persisted` is meant to flag that case, but
// isn't reliable across every browser/navigation path -- resetting unconditionally on every
// pageshow is always safe (a no-op on a genuinely fresh load, since state already matches) and
// avoids depending on that flag at all.
window.addEventListener('pageshow', resetSubmitBtn);

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

    localStorage.setItem('ak-hotel-referral', resolveHotel().referral);

    if (!document.getElementById('ak-flow-trial-spinner-style')) {
        const style = document.createElement('style');
        style.id = 'ak-flow-trial-spinner-style';
        style.textContent = `
            @keyframes ak-flow-trial-spin { to { transform: rotate(360deg); } }
            .ak-flow-trial-spinner {
                width: 14px; height: 14px; flex-shrink: 0;
                border: 2px solid currentColor; border-top-color: transparent;
                border-radius: 50%; animation: ak-flow-trial-spin 0.7s linear infinite;
                opacity: 0.85;
            }
            /* Sits over the (text-hidden) input, centered like its native text would be, since
               the input itself can't hold both a spinner and label as real content. */
            .ak-flow-trial-btn-overlay {
                position: absolute; inset: 0;
                display: flex; align-items: center; justify-content: center; gap: 8px;
                pointer-events: none;
            }
        `;
        document.head.appendChild(style);
    }

    // Read before mutating $submitBtn's own color below -- the overlay needs to match how the
    // button's text actually looks (the ".btn" class may set font/color directly on the input
    // rather than something the overlay, a sibling element, would pick up via `inherit`).
    const btnStyle = getComputedStyle($submitBtn);
    const overlayFont = btnStyle.font;
    const overlayColor = btnStyle.color;
    const overlayLetterSpacing = btnStyle.letterSpacing;
    const overlayTextTransform = btnStyle.textTransform;

    const $wrap = ensureSubmitBtnWrap();
    if (submitBtnOriginalWidth) $submitBtn.style.width = `${submitBtnOriginalWidth}px`;
    $submitBtn.value = 'Redirecting...';
    $submitBtn.style.color = 'transparent'; // hides the native value text; the overlay below shows it instead
    $submitBtn.classList.add('ak-saving');
    $submitBtn.disabled = true;
    $submitBtn.style.opacity = '0.8';
    const $overlay = document.createElement('span');
    $overlay.className = 'ak-flow-trial-btn-overlay';
    $overlay.style.cssText = `font:${overlayFont}; color:${overlayColor}; letter-spacing:${overlayLetterSpacing}; text-transform:${overlayTextTransform};`;
    $overlay.innerHTML = `<span class="ak-flow-trial-spinner"></span>Redirecting...`;
    $wrap.appendChild($overlay);

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
