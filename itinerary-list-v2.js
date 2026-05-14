import { initializeApp } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-app.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-functions.js";

const page1Url = '/customize-itinerary';

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

const $itineraryWrap = document.querySelector('[data-ak="itinerary-list"]');
const $downloadBtn = document.querySelector('[data-ak="download-btn-v2"]');

let itineraryText = "";

// --- Callable function wrapper ---
async function getDataById(userId) {
  const getUserData = httpsCallable(functions, "getUserData");
  try {
    const res = await getUserData({ userId });
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
  $downloadBtn.classList.add("disable");

  // Clear content first
  $itineraryWrap?.textContent = "";

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
  $itineraryWrap?.textContent = msg;
  $itineraryWrap?.classList.add("error");
  $itineraryWrap?.classList.remove("loading");
  $downloadBtn.classList.add("disable");

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
  $itineraryWrap?.textContent = itineraryText || "Itinerary is empty.";
  $itineraryWrap?.classList.remove("error", "loading");
  $downloadBtn.classList.remove("disable");
}

// --- Main ---
async function renderData() {
  showLoading();

  const params = new URLSearchParams(window.location.search);
  const encodedEmail = params.get("id") || params.get("userId");
  const userEmail = encodedEmail ? decodeURIComponent(encodedEmail) : null;

  if (!userEmail) {
    showError("No user id detected in URL.");
    return;
  }

  const userObj = await getDataById(`user-${userEmail}`);
  if (!userObj) {
    showError(`No data found for ${userEmail}`);
    return;
  }

  localStorage['ak-user-db-object'] = JSON.stringify(userObj);

  if (!userObj.savedAttractions) {
    showError(`No saved itinerary found for ${userEmail}`);
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

    const displayName = tripName.charAt(0).toUpperCase() + tripName.slice(1).toLowerCase();
    preliminaryStr += `${displayName}'s Trip To N.Y.C.\n`;
    localStorage['ak-tripName'] = tripName;
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
    showError(`Itinerary data for ${userEmail} is invalid or corrupted.`);
    return;
  }

  if (!attractionLocations || typeof attractionLocations !== "object" || Object.keys(attractionLocations).length === 0) {
    showError(`Itinerary for ${userEmail} is empty.`);
    return;
  }

  renderTxtStyle(attractionLocations, preliminaryStr);
}

// --- Auto-run ---
if (!localStorage['ak-userMail']) {
  showRedirectLoader('User not logged in');
  setTimeout(() => { window.location.href = page1Url; }, 1500);
} else {
  renderData();
}

function showRedirectLoader(message) {
  if (!document.getElementById('il-spinner-style')) {
    const style = document.createElement('style');
    style.id = 'il-spinner-style';
    style.textContent = "@keyframes il-spin { to { transform: rotate(360deg); } }";
    document.head.appendChild(style);
  }
  const overlay = document.createElement('div');
  overlay.id = 'il-loader-overlay';
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0',
    background: 'rgba(255,255,255,0.5)',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    gap: '12px', zIndex: '9999',
  });
  const redirecting = document.createElement('p');
  redirecting.textContent = 'Redirecting...';
  Object.assign(redirecting.style, { margin: '0', fontSize: '14px', color: '#111' });
  overlay.appendChild(redirecting);
  const label = document.createElement('p');
  label.textContent = message;
  Object.assign(label.style, { margin: '0', fontSize: '14px', color: '#111' });
  overlay.appendChild(label);
  const spinner = document.createElement('div');
  Object.assign(spinner.style, {
    width: '40px', height: '40px',
    border: '4px solid #e5e7eb', borderTopColor: '#111',
    borderRadius: '50%', animation: 'il-spin 0.7s linear infinite',
  });
  overlay.appendChild(spinner);
  document.body.appendChild(overlay);
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

$downloadBtn.addEventListener("click", async () => {
  const userMail = localStorage['ak-userMail'];
  if (!userMail) return;

  injectPdfSpinnerStyle();

  const originalHTML = $downloadBtn.innerHTML;
  $downloadBtn.innerHTML = `<span class="ak-pdf-btn-loading"><span class="ak-pdf-spinner"></span>Generating PDF...</span>`;
  $downloadBtn.classList.add("disable");

  try {
    const generateItineraryPdf = httpsCallable(functions, "generateItineraryPdf");
    const { data } = await generateItineraryPdf({ userId: `user-${userMail}` });

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
    $downloadBtn.innerHTML = originalHTML;
    $downloadBtn.classList.remove("disable");
  }
});

function processTitleDates(date) {
  const theDate = parseJSON(date);
  if (!theDate) return;
  const { dateStr, flatpickrDate } = theDate;
  const dateToExtractFrom = dateStr ? dateStr : flatpickrDate;
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
