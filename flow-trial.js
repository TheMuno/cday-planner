const $hotel = document.querySelector('[data-ak="hotel-name"]');
const $lastName = document.querySelector('[data-ak="last-name"]');
const $travelDates = document.querySelector('[data-ak="user-travel-dates"]')?.nextElementSibling;
// Every [data-ak="start-planning"] on the page works the same (e.g. separate desktop/mobile buttons).
const $submitBtns = [...document.querySelectorAll('[data-ak="start-planning"]')];
const $continueBtns = [...document.querySelectorAll('[data-ak="continue-planning"]')];
const $userDataFields = document.querySelectorAll('[data-ak-user-info]');
// Each button is an <input type="submit"> -- a void element with no children, so it can't hold
// a spinner via innerHTML. Its text lives in .value instead, and the spinner has to be a sibling
// element positioned over it rather than content inside it.
const submitBtnOriginalValues = new Map($submitBtns.map($btn => [$btn, $btn.value]));
// Captured before anything (including the wrapper below) can touch layout, since each button's
// own CSS (the "is_100" class) sizes it to 100% of its *original* parent -- measuring later,
// after wrapping, would capture whatever width it collapsed to inside the wrapper instead.
// (A button hidden at load, e.g. a mobile-only one, measures 0 and is simply left unsized.)
const submitBtnOriginalWidths = new Map($submitBtns.map($btn => [$btn, $btn.getBoundingClientRect().width]));

// Dedicated to this flow-trial form -- routes to its own per-hotel sheet via
// resolveFlowTrialHotel() in functions/index.js. Not the same endpoint/sheets used by
// planner.js or firebase-auth.js.
const SAVE_FLOW_TRIAL_URL = 'https://us-central1-askkhonsu-map.cloudfunctions.net/saveFlowTrialSubmission';

// `tag` must match a key in FLOW_TRIAL_HOTELS (functions/index.js) to route to that
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

// Wraps $btn in a relatively-positioned span (once) so the spinner has something to
// absolutely-position itself against, without disturbing the input's own layout/classes.
function ensureSubmitBtnWrap($btn) {
    if ($btn.parentElement?.classList.contains('ak-flow-trial-btn-wrap')) {
        return $btn.parentElement;
    }
    const $wrap = document.createElement('span');
    $wrap.className = 'ak-flow-trial-btn-wrap';
    // display:block (not inline-block) so it doesn't shrink to fit its content -- it needs to
    // fill the same space the input did, or the input's width:100% (the "is_100" class)
    // collapses to the wrapper's intrinsic size instead of the original parent's width.
    $wrap.style.cssText = 'position:relative; display:block;';
    $btn.parentNode.insertBefore($wrap, $btn);
    $wrap.appendChild($btn);
    return $wrap;
}

function resetSubmitBtns() {
    $submitBtns.forEach($btn => {
        $btn.classList.remove('ak-saving');
        $btn.disabled = false;
        $btn.style.opacity = '';
        $btn.style.width = '';
        $btn.style.color = '';
        $btn.value = submitBtnOriginalValues.get($btn);
        $btn.parentElement?.querySelector('.ak-flow-trial-btn-overlay')?.remove();
    });
}

// Bfcache restores the page (and its DOM/JS state, including our mid-submit mutations) exactly
// as it was when the user navigated away. `event.persisted` is meant to flag that case, but
// isn't reliable across every browser/navigation path -- resetting unconditionally on every
// pageshow is always safe (a no-op on a genuinely fresh load, since state already matches) and
// avoids depending on that flag at all.
window.addEventListener('pageshow', () => {
    resetSubmitBtns();
    continuing = false;
});

$submitBtns.forEach($btn => $btn.addEventListener('click', e => handleSubmit(e, $btn)));
$continueBtns.forEach($btn => $btn.addEventListener('click', handleContinue));

const firebaseConfig = {
    apiKey:            "AIzaSyBQPqbtlfHPLpB-JYbyxDZiugu4NqwpSeM",
    authDomain:        "auth.askkhonsu.com",
    projectId:         "askkhonsu-map",
    storageBucket:     "askkhonsu-map.appspot.com",
    messagingSenderId: "266031876218",
    appId:             "1:266031876218:web:ec93411f1c13d9731e93c3",
    measurementId:     "G-Z7F4NJ4PHW",
};

// Only continue-planning needs to know the sign-in state, so Firebase is loaded lazily (never
// blocking the rest of this file) -- but started right away, so it's usually settled by the
// time anyone clicks. authStateReady() waits for the persisted session to be restored;
// auth.currentUser is null until then even for a signed-in user.
const authReady = $continueBtns.length === 0 ? null : Promise.all([
    import('https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js'),
]).then(async ([{ initializeApp, getApps, getApp }, { getAuth }]) => {
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    const auth = getAuth(app);
    await auth.authStateReady();
    return auth;
});

let continuing = false;

async function handleContinue(e) {
    e.preventDefault();
    if (continuing) return;
    if (!validateUserDataFields()) return;
    continuing = true;

    storeFlowTrialKeys();
    // Not awaited: the request is sent with keepalive, so it still completes after the redirect.
    saveUserData();

    let signedIn = false;
    try {
        signedIn = !!(await authReady).currentUser;
    } catch (err) {
        // Firebase failed to load -- /log-in sorts out an already-signed-in user on its own.
        console.error('Failed to check sign-in state:', err);
    }
    window.location.href = signedIn ? resolveHotel().redirect : '/log-in';
}

async function handleSubmit(e, $submitBtn) {
    e.preventDefault();
    // Any button already mid-save means this submission is in flight -- don't send it twice.
    if ($submitBtns.some($btn => $btn.classList.contains('ak-saving'))) return;

    if (!validateUserDataFields()) return;

    storeFlowTrialKeys();

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

    const $wrap = ensureSubmitBtnWrap($submitBtn);
    const submitBtnOriginalWidth = submitBtnOriginalWidths.get($submitBtn);
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
    // The other buttons just go inert -- the spinner belongs to the one that was clicked.
    $submitBtns.forEach($btn => {
        if ($btn !== $submitBtn) $btn.disabled = true;
    });

    // The save is best-effort logging, not a blocking step -- cap how long the spinner waits on
    // it so a slow/dropped request can't strand the user on this page, then redirect regardless.
    const saveTimeout = new Promise(resolve => setTimeout(resolve, 10000));
    await Promise.race([saveUserData(), saveTimeout]);
    window.location.href = redirect;
}

function storeFlowTrialKeys() {
    localStorage.setItem('ak-hotel-referral', resolveHotel().referral);
    // Tells firebase-auth.js this sign-in came through flow-trial: it sends the email to the
    // hotel's "Saves" tab on login without showing the opt-in modal.
    localStorage.setItem('ak-flow-trial-hotel', resolveHotel().referral);
    // Lets the login step find this submission's Views row and fill in the email there.
    localStorage.setItem('ak-flow-trial-reservation', document.querySelector('[data-ak="reservation-num"]')?.value.trim() || '');
}

// Shared by start-planning and continue-planning: highlights the first empty field and returns
// false, or returns true once every field is filled in.
function validateUserDataFields() {
    const emptyUserDataFields = [...$userDataFields].filter(el => !el.value.trim());
    if (emptyUserDataFields.length === 0) return true;

    const emptyField = emptyUserDataFields[0];
    if (emptyField.getAttribute('data-ak') === 'user-travel-dates') {
        highlight(emptyField.nextElementSibling);
    }
    else {
        highlight(emptyField);
    }
    return false;
}

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
            keepalive: true,
        });
        if (!res.ok) throw new Error(`saveFlowTrialSubmission responded ${res.status}`);
    } catch (err) {
        console.error('Failed to save flow-trial submission:', err);
    }
}
