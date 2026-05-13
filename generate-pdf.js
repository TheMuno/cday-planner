'use strict';

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const https = require('https');

const PROJECT_ID = 'askkhonsu-map';
const REGION = 'us-central1';
const FUNCTION_NAME = 'getUserData';

const LOGO_PATH = path.join(__dirname, '..', 'generatepdf', 'Resources', 'Logo_Sample.png');
const FONTS_DIR = path.join(__dirname, 'node_modules', '@fontsource', 'inter', 'files');

// --- Firebase callable function ---
function callFirebaseFunction(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ data: payload });
    const options = {
      hostname: `${REGION}-${PROJECT_ID}.cloudfunctions.net`,
      path: `/${FUNCTION_NAME}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, res => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(raw);
          if (json.result !== undefined) {
            resolve(json.result);
          } else {
            const msg = (json.error && json.error.message) || `HTTP ${res.statusCode}: ${raw}`;
            reject(new Error(msg));
          }
        } catch {
          reject(new Error('Could not parse Firebase response: ' + raw));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// --- Helpers ---
function parseJSON(str) {
  try { return JSON.parse(str); } catch { return null; }
}

function processDates(travelDates) {
  const obj = parseJSON(travelDates);
  if (!obj) return '';
  const raw = obj.dateStr || obj.flatpickrDate || '';
  const [start, end] = raw.split(/\s+to\s+/);
  if (!start) return raw;
  const fmt = d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return end ? `${fmt(start)} – ${fmt(end)}` : fmt(start);
}

function fontFaceCSS() {
  if (!fs.existsSync(FONTS_DIR)) return '';
  const weights = [300, 400, 500, 600, 700, 800, 900];
  const faces = weights.flatMap(w => {
    const f = path.join(FONTS_DIR, `inter-latin-${w}-normal.woff2`);
    if (!fs.existsSync(f)) return [];
    const b64 = fs.readFileSync(f).toString('base64');
    return [`@font-face{font-family:'Inter';font-style:normal;font-weight:${w};src:url('data:font/woff2;base64,${b64}')format('woff2');}`];
  });
  const italicFile = path.join(FONTS_DIR, 'inter-latin-400-italic.woff2');
  if (fs.existsSync(italicFile)) {
    const b64 = fs.readFileSync(italicFile).toString('base64');
    faces.push(`@font-face{font-family:'Inter';font-style:italic;font-weight:400;src:url('data:font/woff2;base64,${b64}')format('woff2');}`);
  }
  return faces.join('\n');
}

// --- HTML builder ---
const SECTIONS = [
  { key: 'attractions', label: 'ATTRACTIONS',       symbol: '&#9679;' },
  { key: 'restaurants', label: 'RESTAURANTS',        symbol: '&#9135;' },
  { key: 'notes',       label: 'LOCAL EXPERIENCES',  symbol: '&#9670;' },
];
const oldKeyMap = { attractions: 'morning', restaurants: 'afternoon', notes: 'evening' };

function renderDay(slide, dayNum) {
  let totalCount = 0;
  let sectionsHTML = '';

  for (const { key, label, symbol } of SECTIONS) {
    const items = slide[key] || slide[oldKeyMap[key]];
    if (!items || !items.length) continue;
    totalCount += items.length;
    sectionsHTML += `
      <div class="section-header">
        <span class="badge">${symbol} ${label}</span>
      </div>
      <ul class="activity-list">
        ${items.map(item => `<li>${item.displayName || ''}</li>`).join('')}
      </ul>`;
  }

  if (!sectionsHTML) return '';

  return `
    <div class="day">
      <div class="day-heading">
        <span class="day-name">DAY ${dayNum}</span>
        <span class="day-count">${totalCount} ${totalCount === 1 ? 'activity' : 'activities'}</span>
      </div>
      <hr class="divider">
      ${sectionsHTML}
    </div>`;
}

function buildHTML(user) {
  const tripName   = user.tripName || 'Traveler';
  const dates      = processDates(user.travelDates);
  const hotel      = parseJSON(user.hotel)?.displayName          || '';
  const arrival    = parseJSON(user.arrivalAirport)?.displayName  || '';
  const departure  = parseJSON(user.departureAirport)?.displayName || '';
  const savedAttractions = parseJSON(user.savedAttractions) || {};

  const logoDataUrl = fs.existsSync(LOGO_PATH)
    ? `data:image/png;base64,${fs.readFileSync(LOGO_PATH).toString('base64')}`
    : null;

  const printDate = new Date().toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  const daySections = Object.values(savedAttractions)
    .map((slide, i) => renderDay(slide, i + 1))
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  ${fontFaceCSS()}

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    color: #1c1c1c;
    background: white;
    font-size: 13px;
    line-height: 1.4;
    -webkit-font-smoothing: antialiased;
  }

  /* Header */
  .header {
    background: #181818;
    padding: 0 40px;
    height: 44px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .logo {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #e8e8e8;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.2em;
  }
  .logo-dot {
    width: 8px;
    height: 8px;
    background: #e85d26;
    border-radius: 50%;
  }
  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .header-url { color: #888; font-size: 11px; }
  .header-logo { height: 44px; width: auto; object-fit: contain; }

  /* Hero */
  .hero {
    margin: 36px 40px 28px;
    padding-left: 20px;
    border-left: 5px solid #e85d26;
  }
  .hero-title {
    font-size: 52px;
    font-weight: 900;
    line-height: 1.05;
    letter-spacing: -0.03em;
    color: #1c1c1c;
  }
  .hero-dates {
    font-size: 20px;
    font-weight: 600;
    color: #e85d26;
    margin-top: 10px;
  }

  /* Info bar */
  .info-bar {
    display: flex;
    border-top: 1px solid #e2e2e2;
    border-bottom: 1px solid #e2e2e2;
    margin: 0 40px 30px;
  }
  .info-cell {
    flex: 1;
    padding: 14px 18px;
    border-right: 1px solid #e2e2e2;
  }
  .info-cell:last-child { border-right: none; }
  .info-label {
    font-size: 8.5px;
    font-weight: 600;
    letter-spacing: 0.14em;
    color: #aaa;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .info-primary { font-size: 14px; font-weight: 600; color: #1c1c1c; }

  /* Day sections */
  .day {
    padding: 24px 40px 8px;
    page-break-inside: avoid;
  }
  .day-heading {
    display: flex;
    align-items: baseline;
    gap: 12px;
    margin-bottom: 10px;
  }
  .day-name { font-size: 20px; font-weight: 700; letter-spacing: -0.01em; }
  .day-count { font-size: 11px; color: #aaa; font-weight: 400; }
  .divider {
    border: none;
    border-top: 1px solid #e0e0e0;
    margin-bottom: 18px;
  }

  /* Badges */
  .section-header { margin-bottom: 10px; }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #e85d26;
    color: white;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.13em;
    padding: 4px 10px;
  }

  /* Activity list */
  .activity-list {
    list-style: none;
    margin-bottom: 20px;
    border-top: 1px solid #ebebeb;
  }
  .activity-list li {
    padding: 10px 0;
    font-size: 13px;
    color: #1c1c1c;
    border-bottom: 1px solid #f0f0f0;
  }
  .activity-list li:last-child { border-bottom: none; }

  /* Footer */
  .footer {
    border-top: 1px solid #e2e2e2;
    margin-top: 20px;
    padding: 14px 40px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .footer-info {
    font-size: 9.5px;
    color: #bbb;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .footer-date { font-size: 9.5px; color: #bbb; }
  .footer-cta {
    padding: 16px 40px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .footer-cta-text { font-size: 12px; color: #888; }
  .footer-cta-link {
    font-size: 11px;
    font-weight: 700;
    color: #e85d26;
    letter-spacing: 0.08em;
  }
</style>
</head>
<body>

<div class="header">
  <div class="logo">
    <div class="logo-dot"></div>
    KHONSU
  </div>
  <div class="header-right">
    <div class="header-url">askkhonsu.com</div>
    ${logoDataUrl ? `<img src="${logoDataUrl}" class="header-logo" alt="">` : ''}
  </div>
</div>

<div class="hero">
  <div class="hero-title">${tripName.toUpperCase()}'S TRIP<br>TO N.Y.C.</div>
  ${dates ? `<div class="hero-dates">${dates}</div>` : ''}
</div>

<div class="info-bar">
  <div class="info-cell">
    <div class="info-label">Hotel</div>
    <div class="info-primary">${hotel}</div>
  </div>
  <div class="info-cell">
    <div class="info-label">Arriving</div>
    <div class="info-primary">${arrival}</div>
  </div>
  <div class="info-cell">
    <div class="info-label">Departing</div>
    <div class="info-primary">${departure}</div>
  </div>
</div>

${daySections}

<div class="footer">
  <div class="footer-info">ASKKHONSU.COM &middot; HELLO@ASKKHONSU.COM</div>
  <div class="footer-date">Printed ${printDate}</div>
</div>
<div class="footer-cta">
  <div class="footer-cta-text">Want a live map, ticket savings &amp; one click reservations?</div>
  <div class="footer-cta-link">UPGRADE TO SMART GUIDE &rarr;</div>
</div>

</body>
</html>`;
}

// --- Main ---
async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: node generate-pdf.js <email>');
    process.exit(1);
  }

  const userId = `user-${email}`;
  console.log(`Fetching data for ${userId}...`);

  let result;
  try {
    result = await callFirebaseFunction({ userId });
  } catch (err) {
    console.error('Firebase error:', err.message);
    process.exit(1);
  }

  const user = result && result.user;
  if (!user) {
    console.error(`No data found for ${email}`);
    process.exit(1);
  }
  if (!user.savedAttractions) {
    console.error(`No saved itinerary found for ${email}`);
    process.exit(1);
  }

  console.log('Building PDF...');
  const html = buildHTML(user);

  const tempHtml = path.join(__dirname, '_render.html');
  fs.writeFileSync(tempHtml, html, 'utf8');

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(`file:///${tempHtml.replace(/\\/g, '/')}`, { waitUntil: 'networkidle0' });

  const safeName = (user.tripName || email).replace(/[^a-z0-9_\-]/gi, '_');
  const outPath = path.join(__dirname, `${safeName}-itinerary.pdf`);

  await page.pdf({
    path: outPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' },
  });

  await browser.close();
  fs.unlinkSync(tempHtml);
  console.log(`Done → ${outPath}`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
