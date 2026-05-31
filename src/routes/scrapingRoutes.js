const express = require('express');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const { discover } = require('../../lib/steps/discover');

function createScrapingRoutes({ taskManager }) {
  const router = express.Router();

  // Quick "is this page scrapable" probe used before a full run.
  router.post('/analyze', async (req, res) => {
    let browser = null;
    try {
      const { url } = req.body;
      if (!url) return res.status(400).json({ error: 'URL is required' });

      browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const html = await page.content();
      await browser.close();
      browser = null;

      const $ = cheerio.load(html);
      const hasName = $('meta[itemprop="name"]').length > 0 || $('h1').length > 0;
      const hasAddress = $('meta[itemprop="address"]').length > 0 || $('[data-item-id="address"]').length > 0;
      const hasPhone = $('meta[itemprop="telephone"]').length > 0 || $('a[href^="tel:"]').length > 0;
      const hasWebsite = $('meta[itemprop="url"]').length > 0 || $('a[href^="http"]').length > 0;

      res.json({
        success: true,
        url,
        pageInfo: {
          title: $('title').text(),
          hasStructuredData: hasName || hasAddress || hasPhone || hasWebsite,
          dataTypes: { name: hasName, address: hasAddress, phone: hasPhone, website: hasWebsite }
        },
        message: 'Page analyzed successfully. Ready to extract data.'
      });
    } catch (error) {
      if (browser) await browser.close();
      res.status(500).json({ error: 'Failed to analyze website', details: error.message });
    }
  });

  // Scrape a Google Maps search/place. Delegates to the shared discover step.
  router.post('/scrape', async (req, res) => {
    const { url, duration, runInBackground } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    if (runInBackground) {
      const task = taskManager.createTask(
        'scraping',
        `Google Maps: ${url.substring(0, 50)}... (${duration || 15}min)`,
        { url, duration }
      );
      res.json({ success: true, taskId: task.id });
      runScrape(task.id, url, duration);
      return;
    }

    try {
      const data = await discover({ url, duration }, {});
      res.json({ success: true, data, count: data.length });
    } catch (error) {
      res.status(500).json({ error: 'Failed to scrape website', details: error.message });
    }
  });

  // Background variant: same discover step, progress relayed to taskManager.
  async function runScrape(taskId, url, duration) {
    try {
      taskManager.updateTaskStatus(taskId, 'running', 'Starting Google Maps scraping...');
      const data = await discover(
        { url, duration },
        {
          onProgress: (progress, message) => taskManager.updateTaskProgress(taskId, progress, message),
          isCancelled: () => !taskManager.getTask(taskId)
        }
      );
      taskManager.completeTask(taskId, data);
    } catch (error) {
      taskManager.failTask(taskId, error);
    }
  }

  return router;
}

module.exports = { createScrapingRoutes };
