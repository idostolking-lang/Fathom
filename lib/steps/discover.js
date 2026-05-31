// "Discover" step: scrape a Google Maps search or place into business rows.
// Decoupled from taskManager: progress and cancellation flow through ctx
// callbacks, so the HTTP route and the Routines engine share one implementation.
const puppeteer = require('puppeteer');
const { UA, wait } = require('./_shared');

// Runs inside the page; extracts one business card.
function extractBusiness() {
  const data = { Name: '', Address: '', Phone: '', Website: '' };
  const nameEl = document.querySelector('h1.DUwDvf, h1.fontHeadlineLarge');
  if (nameEl) data.Name = nameEl.textContent.trim();
  const address = document.querySelector('button[data-item-id="address"]');
  if (address) data.Address = address.textContent.trim();
  const phone = document.querySelector('button[data-item-id*="phone"]');
  if (phone) data.Phone = phone.textContent.trim();
  const website = document.querySelector('a[data-item-id="authority"]');
  if (website) data.Website = website.getAttribute('href') || '';
  return data;
}

async function discover(config = {}, ctx = {}) {
  const { url, duration = 15 } = config;
  const onProgress = ctx.onProgress || (() => {});
  const isCancelled = ctx.isCancelled || (() => false);
  if (!url) throw new Error('discover: a Google Maps url is required');

  let browser = null;
  try {
    const deadline = Date.now() + (duration || 15) * 60 * 1000;
    onProgress(5, 'Launching browser');
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(UA);

    onProgress(10, 'Loading Google Maps');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await wait(5000);

    const isSearch = await page.evaluate(() => document.querySelector('[role="feed"]') !== null);
    onProgress(15, `Detected ${isSearch ? 'search results' : 'single place'}`);

    const results = [];
    if (isSearch) {
      if (await page.$('[role="feed"]')) {
        onProgress(20, 'Scrolling to load businesses');
        let stale = 0;
        let previous = 0;
        while (Date.now() < deadline - (duration * 60 * 1000) * 0.7) {
          if (isCancelled()) { await browser.close(); return results; }
          await page.evaluate(() => { const d = document.querySelector('[role="feed"]'); if (d) d.scrollTop = d.scrollHeight; });
          await wait(1500);
          const height = await page.evaluate(() => { const d = document.querySelector('[role="feed"]'); return d ? d.scrollHeight : 0; });
          if (height === previous) { if (++stale > 3) break; } else stale = 0;
          previous = height;
        }
      }
      const links = await page.evaluate(() => {
        const out = [];
        document.querySelectorAll('a[href*="/maps/place/"]').forEach((el) => {
          const href = el.getAttribute('href');
          if (href && !out.includes(href)) out.push(href);
        });
        return out;
      });
      onProgress(30, `Found ${links.length} businesses`);

      for (let i = 0; i < links.length; i++) {
        if (isCancelled()) break;
        if (Date.now() >= deadline) { onProgress(90, `Time limit reached at ${i}`); break; }
        onProgress(30 + Math.floor((i / Math.max(links.length, 1)) * 60), `Visiting ${i + 1}/${links.length}`);
        try {
          const target = links[i].startsWith('http') ? links[i] : `https://www.google.com${links[i]}`;
          await page.goto(target, { waitUntil: 'networkidle2', timeout: 30000 });
          await wait(1500);
          const business = await page.evaluate(extractBusiness);
          if (business.Name) results.push(business);
        } catch { /* skip a single bad place */ }
      }
    } else {
      onProgress(50, 'Extracting place');
      const business = await page.evaluate(extractBusiness);
      if (business.Name) results.push(business);
    }

    await browser.close();
    browser = null;
    onProgress(100, `Collected ${results.length} businesses`);
    return results;
  } catch (err) {
    if (browser) { try { await browser.close(); } catch { /* ignore */ } }
    throw err;
  }
}

module.exports = { discover };
