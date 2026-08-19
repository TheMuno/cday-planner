import { initializeApp } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-app.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-functions.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-auth.js";

// --- Firebase config ---
const firebaseConfig = {
  apiKey: "AIzaSyBQPqbtlfHPLpB-JYbyxDZiugu4NqwpSeM",
  authDomain: "askkhonsu-map.firebaseapp.com",
  projectId: "askkhonsu-map",
  storageBucket: "askkhonsu-map.appspot.com",
  messagingSenderId: "266031876218",
  appId: "1:266031876218:web:ec93411f1c13d9731e93c3",
  measurementId: "G-Z7F4NJ4PHW"
};

const app = initializeApp(firebaseConfig);
const functions = getFunctions(app);
const auth = getAuth(app);

const $itineraryWrap = document.querySelector('[data-ak="itinerary-list"]');
const $downloadBtns = document.querySelectorAll('[data-ak="download-btn-v2"]');

let itineraryText = "";

// --- Callable function wrapper ---
async function getDataByToken(shareToken) {
  const getUserData = httpsCallable(functions, "getUserData");
  try {
    const res = await getUserData({ shareToken });
    const { data } = res;
    return data.user;
  } catch (err) {
    if (err.code && err.message) {
      console.error(`❌ Firebase error [${err.code}]: ${err.message}`);
      showError(`Error: ${err.message}`);
    } else {
      console.error("❌ Unexpected error:", err);
      showError("Something went wrong while fetching user data.");
    }
    return null;
  }
}

// --- Helpers ---
function showLoading(msg = "Loading itinerary...") {
  $itineraryWrap?.classList.add("loading");
  $itineraryWrap?.classList.remove("error");
  $itineraryWrap?.classList.add("disable");
  
  // Clear content first
  if ($itineraryWrap) $itineraryWrap.textContent = "";

  // Spinner element
  const spinner = document.createElement("div");
  spinner.className = "ak-spinner";

  const text = document.createElement("span");
  text.textContent = msg;

  $itineraryWrap?.appendChild(spinner);
  $itineraryWrap?.appendChild(text);
}

function showError(msg) {
  console.error("❌", msg);
  if ($itineraryWrap) $itineraryWrap.textContent = msg;
  $itineraryWrap?.classList.add("error");
  $itineraryWrap?.classList.remove("loading");
  $itineraryWrap?.classList.add("disable");
  
  // Retry button
  const retryBtn = document.createElement("button");
  retryBtn.textContent = "Retry";
  retryBtn.className = "ak-retry-btn";
  retryBtn.onclick = () => {
    retryBtn.remove();
    renderData();
  };
  $itineraryWrap?.appendChild(document.createElement("br"));
  $itineraryWrap?.appendChild(retryBtn);
}

const sectionMap = {
  attractions: "Attractions",
  restaurants: "Restaurants",
  notes: "Local Experiences"
};
const oldKeyMap = { attractions: 'morning', restaurants: 'afternoon', notes: 'evening' };

function renderTxtStyle(data, preliminaryStr='') {
  let output = "";
  if (preliminaryStr.length) output += preliminaryStr + '\n';
  let slideNum = 1;

  for (const slide in data) {
    const sections = data[slide];
    let dayOutput = `Day${slideNum}\n\n`;
    let hasContent = false;

    for (const key of ["attractions", "restaurants", "notes"]) {
      const items = sections[key] || sections[oldKeyMap[key]];
      if (items && items.length > 0) {
        hasContent = true;
        dayOutput += `${sectionMap[key]}\n\n`;
        items.forEach(item => {
          if (item.displayName) {
            dayOutput += `${item.displayName}\n`;
          }
        });
        dayOutput += `\n`;
      }
    }

    if (hasContent) {
      output += dayOutput + `\n`;
    }

    slideNum++;
  }

  itineraryText = output.trim();
  if ($itineraryWrap) $itineraryWrap.textContent = itineraryText || "Itinerary is empty.";
  $itineraryWrap?.classList.remove("error", "loading");
  $itineraryWrap?.classList.remove("disable");
  }

// --- Regenerate share link ---
// getMyShareToken always mints/replaces a token for the *caller's own* account, regardless of
// whose itinerary is on screen — so calling it is harmless even if this somehow fired for a non-
// owner. The visibility gate below is purely so a friend viewing someone else's shared itinerary
// doesn't see a confusing "regenerate MY link" button that (silently, harmlessly) wouldn't affect
// what they're looking at.
function wireRegenerateShareLink(userObj) {
  const $btn = document.querySelector('[data-ak="regenerate-share-link"]');
  if (!$btn) return;

  onAuthStateChanged(auth, user => {
    if (user && `user-${user.email}` === userObj.id) {
      $btn.removeAttribute('data-ak-hidden');
    }
  });

  $btn.addEventListener('click', async e => {
    e.preventDefault();
    if ($btn.disabled) return;
    $btn.disabled = true;
    const original = $btn.textContent;
    $btn.textContent = 'Generating...';

    let resultText = 'Failed, try again';
    try {
      const getMyShareToken = httpsCallable(functions, 'getMyShareToken');
      const { data } = await getMyShareToken({ regenerate: true });

      const params = new URLSearchParams(window.location.search);
      params.set('token', data.shareToken);
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      history.replaceState(null, '', newUrl);
      const fullUrl = `${window.location.origin}${newUrl}`;

      try {
        await navigator.clipboard.writeText(fullUrl);
        resultText = 'Copied new link!';
      } catch {
        alert(`Your new share link (old links no longer work):\n${fullUrl}`);
        resultText = original;
      }
    } catch (err) {
      console.error('Failed to regenerate share link:', err);
    } finally {
      $btn.textContent = resultText;
      setTimeout(() => { $btn.textContent = original; $btn.disabled = false; }, 2000);
    }
  });
}

// --- Main ---
async function renderData() {
  showLoading();

  const params = new URLSearchParams(window.location.search);
  const shareToken = params.get("token");

  if (!shareToken) {
    showError("No share link detected in URL.");
    return;
  }

  const userObj = await getDataByToken(shareToken);
  if (!userObj) {
    showError("No itinerary found for this link.");
    return;
  }

  wireRegenerateShareLink(userObj);
  localStorage['ak-user-db-object'] = JSON.stringify(userObj);

  if (!userObj.savedAttractions) {
    showError("No saved itinerary found for this link.");
    return;
  }

  let attractionLocations, hotelName, arrival, departure, preliminaryStr = '';
  try {
    const { tripName,
    				travelDates,
    				hotel,
            arrivalAirport,
            departureAirport,
            savedAttractions } = userObj;

    // tripName can be empty/undefined (e.g. no name ever saved for this trip) — unconditionally
    // calling .charAt(0) on it would throw and get misreported downstream as corrupted itinerary
    // data, blocking an otherwise perfectly valid itinerary from loading.
    const displayName = tripName ? tripName.charAt(0).toUpperCase() + tripName.slice(1).toLowerCase() : 'Traveler';
    preliminaryStr += `${displayName}'s Trip To N.Y.C.\n`;
    localStorage['ak-tripName'] = tripName || '';
    const titleDatesStr = processTitleDates(travelDates);
    preliminaryStr += `${titleDatesStr ? titleDatesStr + '\n\n' : ''}`;

    if (hotel) {
      hotelName = parseJSON(hotel)?.displayName;
      preliminaryStr += `Hotel\n${hotelName || ''}\n\n`;
    }
    if (arrivalAirport) {
      arrival = parseJSON(arrivalAirport)?.displayName;
      preliminaryStr += `Arrival Location\n${arrival || ''}\n\n`;
    }
    if (departureAirport) {
      departure = parseJSON(departureAirport)?.displayName;
      preliminaryStr += `Departure Location\n${departure || ''}\n\n`;
    }

    attractionLocations = parseJSON(savedAttractions);
  }
  catch (err) {
    console.error("Error parsing savedAttractions JSON:", err);
    showError("This itinerary's data is invalid or corrupted.");
    return;
  }

  if (!attractionLocations || typeof attractionLocations !== "object" || Object.keys(attractionLocations).length === 0) {
    showError("This itinerary is empty.");
    return;
  }

  renderTxtStyle(attractionLocations, preliminaryStr);
}

// --- Auto-run ---
// No login requirement — this page is meant to be viewable via a shared link (the shareToken in
// the URL is itself the access credential) without the viewer needing an account.
if (location.hostname !== 'ask-khonsu.webflow.io' && location.hostname !== 'www.askkhonsu.com') {
  renderData();
}


// --- Download as PDF ---
function injectPdfSpinnerStyle() {
  if (document.getElementById("ak-pdf-spinner-style")) return;
  const style = document.createElement("style");
  style.id = "ak-pdf-spinner-style";
  style.textContent = `
    @keyframes ak-pdf-spin { to { transform: rotate(360deg); } }
    .ak-pdf-spinner {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid currentColor;
      border-top-color: transparent;
      border-radius: 50%;
      animation: ak-pdf-spin 0.7s linear infinite;
      opacity: 0.8;
      flex-shrink: 0;
    }
    .ak-pdf-btn-loading {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
  `;
  document.head.appendChild(style);
}

if ($downloadBtns.length) {
  let isLoading = false;

  $downloadBtns.forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      if (isLoading) return;
      // The share token already in the URL is what's actually being viewed on this page — using
      // it here (rather than the viewer's own ak-userMail) is what lets a friend download the PDF
      // for the itinerary they're looking at, not whatever's tied to their own account.
      const shareToken = new URLSearchParams(window.location.search).get('token');
      if (!shareToken) return;

      isLoading = true;
      injectPdfSpinnerStyle();

      const originals = Array.from($downloadBtns).map(b => b.innerHTML);
      $downloadBtns.forEach(b => {
        b.innerHTML = `<span class="ak-pdf-btn-loading"><span class="ak-pdf-spinner"></span>Creating Guide...</span>`;
        b.disabled = true;
        b.style.opacity = '0.8';
      });
      $itineraryWrap?.classList.add("disable");

      try {
        const generateItineraryPdf = httpsCallable(functions, "generateItineraryPdf");
        const { data } = await generateItineraryPdf({ shareToken });

        const bytes = Uint8Array.from(atob(data.pdf), c => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = data.filename;
        a.click();

        URL.revokeObjectURL(url);
      } catch (err) {
        console.error("❌ PDF generation failed:", err);
        alert("Failed to generate PDF. Please try again.");
      } finally {
        isLoading = false;
        $downloadBtns.forEach((b, i) => {
          b.innerHTML = originals[i];
          b.disabled = false;
          b.style.opacity = '';
        });
        $itineraryWrap?.classList.remove("disable");
      }
    });
  });
}

function processTitleDates(date) {
  const theDate = parseJSON(date);
  if (!theDate) return;
  const { dateStr, flatpickrDate } = theDate;
  const dateToExtractFrom = flatpickrDate ? flatpickrDate : dateStr;
  const [ startDate, endDate ] = dateToExtractFrom.split(/\s+to\s+/);
  return getTitleDates(startDate, endDate);
}

function getTitleDates(startDate, endDate) {
  const monthArr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  let titleStartDate = new Date(startDate);
  let titleEndDate = new Date(endDate);
  titleStartDate = `${monthArr[titleStartDate.getMonth()]} ${titleStartDate.getDate()}`;
  titleEndDate = `${monthArr[titleEndDate.getMonth()]} ${titleEndDate.getDate()}`;

  const sameDay = titleStartDate === titleEndDate;
  const titleDates = sameDay ? titleStartDate : `${titleStartDate} - ${titleEndDate}`;
  return titleDates;
}

function parseJSON(jsonStr) {
  let jsonObj = null;

  try {
    jsonObj = JSON.parse(jsonStr);
  }
  catch (e) {
      return null;
  }

  return jsonObj;
}
