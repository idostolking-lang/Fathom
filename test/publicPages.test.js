const assert = require('node:assert/strict');
const express = require('express');
const path = require('node:path');
const test = require('node:test');
const { chromium } = require('playwright');

const projectRoot = path.resolve(__dirname, '..');

function listen(app) {
  return new Promise(resolve => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
}

test('past analyses page renders analyses saved by the message analyzer', async () => {
  const app = express();
  app.get('/favicon.ico', (_req, res) => res.status(204).end());
  app.use(express.static(path.join(projectRoot, 'public')));
  const server = await listen(app);
  const browser = await chromium.launch({ headless: true });

  try {
    const { port } = server.address();
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await page.addInitScript(() => {
      localStorage.setItem('savedAnalyses', JSON.stringify([{
        id: 1,
        name: 'Analyzer Saved Shape',
        analysis: 'The customer asks about price and timing.',
        behaviorInstructions: '',
        messagesPreview: 'Can you send pricing?',
        date: new Date().toISOString()
      }]));
    });

    await page.goto(`http://127.0.0.1:${port}/past-analyses.html`, { waitUntil: 'load' });
    await page.waitForTimeout(100);

    assert.deepEqual(errors, []);
    assert.match(await page.textContent('body'), /Analyzer Saved Shape/);
  } finally {
    await browser.close();
    server.close();
  }
});

test('past analyses page renders legacy pastAnalyses localStorage key', async () => {
  const app = express();
  app.get('/favicon.ico', (_req, res) => res.status(204).end());
  app.use(express.static(path.join(projectRoot, 'public')));
  const server = await listen(app);
  const browser = await chromium.launch({ headless: true });

  try {
    const { port } = server.address();
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await page.addInitScript(() => {
      localStorage.setItem('pastAnalyses', JSON.stringify([{
        id: 2,
        name: 'Legacy Analysis Shape',
        analysis: 'Legacy analysis body.',
        date: new Date().toISOString()
      }]));
    });

    await page.goto(`http://127.0.0.1:${port}/past-analyses.html`, { waitUntil: 'load' });
    await page.waitForTimeout(100);

    assert.deepEqual(errors, []);
    assert.match(await page.textContent('body'), /Legacy Analysis Shape/);
  } finally {
    await browser.close();
    server.close();
  }
});

test('past analyses page falls back to legacy key when savedAnalyses is empty', async () => {
  const app = express();
  app.get('/favicon.ico', (_req, res) => res.status(204).end());
  app.use(express.static(path.join(projectRoot, 'public')));
  const server = await listen(app);
  const browser = await chromium.launch({ headless: true });

  try {
    const { port } = server.address();
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await page.addInitScript(() => {
      localStorage.setItem('savedAnalyses', JSON.stringify([]));
      localStorage.setItem('pastAnalyses', JSON.stringify([{
        id: 4,
        name: 'Legacy Analysis Behind Empty Current Key',
        analysis: 'Legacy analysis body.',
        date: new Date().toISOString()
      }]));
    });

    await page.goto(`http://127.0.0.1:${port}/past-analyses.html`, { waitUntil: 'load' });
    await page.waitForTimeout(100);

    assert.deepEqual(errors, []);
    assert.match(await page.textContent('body'), /Legacy Analysis Behind Empty Current Key/);
  } finally {
    await browser.close();
    server.close();
  }
});

test('email results page renders legacy emailExtractionResults localStorage key', async () => {
  const app = express();
  app.get('/favicon.ico', (_req, res) => res.status(204).end());
  app.use(express.static(path.join(projectRoot, 'public')));
  const server = await listen(app);
  const browser = await chromium.launch({ headless: true });

  try {
    const { port } = server.address();
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await page.addInitScript(() => {
      localStorage.setItem('emailExtractionResults', JSON.stringify([{
        name: 'Legacy Email Business',
        website: 'https://legacy.example',
        email: 'hello@legacy.example'
      }]));
    });

    await page.goto(`http://127.0.0.1:${port}/email-results.html`, { waitUntil: 'load' });
    await page.waitForTimeout(100);

    assert.deepEqual(errors, []);
    assert.match(await page.textContent('body'), /Legacy Email Business/);
  } finally {
    await browser.close();
    server.close();
  }
});

test('email results page falls back to legacy key when emailResults is empty', async () => {
  const app = express();
  app.get('/favicon.ico', (_req, res) => res.status(204).end());
  app.use(express.static(path.join(projectRoot, 'public')));
  const server = await listen(app);
  const browser = await chromium.launch({ headless: true });

  try {
    const { port } = server.address();
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await page.addInitScript(() => {
      localStorage.setItem('emailResults', JSON.stringify([]));
      localStorage.setItem('emailExtractionResults', JSON.stringify([{
        name: 'Legacy Email Behind Empty Current Key',
        website: 'https://legacy-empty.example',
        email: 'hello@legacy-empty.example'
      }]));
    });

    await page.goto(`http://127.0.0.1:${port}/email-results.html`, { waitUntil: 'load' });
    await page.waitForTimeout(100);

    assert.deepEqual(errors, []);
    assert.match(await page.textContent('body'), /Legacy Email Behind Empty Current Key/);
  } finally {
    await browser.close();
    server.close();
  }
});

test('saved reports page derives business count from legacy businesses array', async () => {
  const app = express();
  app.get('/favicon.ico', (_req, res) => res.status(204).end());
  app.use(express.static(path.join(projectRoot, 'public')));
  const server = await listen(app);
  const browser = await chromium.launch({ headless: true });

  try {
    const { port } = server.address();
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await page.addInitScript(() => {
      localStorage.setItem('savedReports', JSON.stringify([{
        id: 3,
        name: 'Legacy Saved Report',
        report: 'Legacy report body.',
        instructions: 'Find pricing signals.',
        businesses: [{ name: 'One' }, { name: 'Two' }],
        date: new Date().toISOString()
      }]));
    });

    await page.goto(`http://127.0.0.1:${port}/saved-reports.html`, { waitUntil: 'load' });
    await page.waitForTimeout(100);

    const body = await page.textContent('body');
    assert.deepEqual(errors, []);
    assert.match(body, /Legacy Saved Report/);
    assert.match(body, /2 businesses/);
    assert.doesNotMatch(body, /undefined businesses/);
  } finally {
    await browser.close();
    server.close();
  }
});
