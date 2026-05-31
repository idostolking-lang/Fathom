// "Enrich" step: visit each business website and pull a contact email.
// Keeps every existing field and adds an `Email` column to each row.
const puppeteer = require('puppeteer');
const { UA, wait, getField } = require('./_shared');

// Runs inside the page; returns the best contact email found, or ''.
function scrapeEmail() {
  const mailto = document.querySelector('a[href^="mailto:"]');
  if (mailto) {
    const href = mailto.getAttribute('href') || '';
    return href.replace('mailto:', '').split('?')[0].trim();
  }
  const text = document.body ? document.body.innerText : '';
  const matches = text.match(/[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,}/g);
  if (matches && matches.length) {
    const valid = matches.filter((e) => {
      const l = e.toLowerCase();
      return !['example.com', 'test.com', 'placeholder', 'yourdomain', 'yoursite', '.png', '.jpg', '.gif']
        .some((bad) => l.includes(bad));
    });
    if (valid.length) return valid[0];
  }
  const meta = document.querySelector('meta[property*="email"], meta[name*="email"]');
  if (meta) {
    const content = meta.getAttribute('content') || '';
    if (content.includes('@')) return content.trim();
  }
  return '';
}

async function enrich(rows = [], config = {}, ctx = {}) {
  const onProgress = ctx.onProgress || (() => {});
  const isCancelled = ctx.isCancelled || (() => false);
  const log = ctx.log || (() => {});

  let browser = null;
  try {
    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const out = [];
    let found = 0;

    for (let i = 0; i < rows.length; i++) {
      if (isCancelled()) break;
      const row = rows[i];
      const name = getField(row, 'name') || 'Unknown';
      const website = getField(row, 'website');
      onProgress(Math.floor((i / Math.max(rows.length, 1)) * 100), `Visiting ${i + 1}/${rows.length}: ${name}`);

      if (!String(website).trim()) {
        out.push({ ...row, Email: getField(row, 'email') || '' });
        continue;
      }
      try {
        const page = await browser.newPage();
        await page.setUserAgent(UA);
        await page.goto(website, { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
        await wait(1500);
        const email = await page.evaluate(scrapeEmail);
        await page.close();
        if (email) { found++; log(`Email for ${name}: ${email}`, 'success'); }
        out.push({ ...row, Email: email || getField(row, 'email') || '' });
      } catch (err) {
        out.push({ ...row, Email: getField(row, 'email') || '', error: err.message });
      }
      await wait(500);
    }

    await browser.close();
    browser = null;
    onProgress(100, `Found ${found} emails across ${rows.length} sites`);
    return out;
  } catch (err) {
    if (browser) { try { await browser.close(); } catch { /* ignore */ } }
    throw err;
  }
}

module.exports = { enrich };
