const assert = require('node:assert/strict');
const test = require('node:test');

const { resolveExecutablePath } = require('../lib/puppeteerExecutable');

test('resolveExecutablePath supports async Puppeteer executablePath APIs', async () => {
  const path = await resolveExecutablePath({
    executablePath: () => Promise.resolve('C:\\Chrome\\chrome.exe')
  });

  assert.equal(path, 'C:\\Chrome\\chrome.exe');
});

test('resolveExecutablePath supports sync Puppeteer executablePath APIs', async () => {
  const path = await resolveExecutablePath({
    executablePath: () => 'C:\\Chrome\\chrome.exe'
  });

  assert.equal(path, 'C:\\Chrome\\chrome.exe');
});
