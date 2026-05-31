const assert = require('node:assert/strict');
const test = require('node:test');

const {
  extractWebsiteFrontend,
  formatWebsiteContext,
  limitText,
  normalizeUrl
} = require('../lib/websiteExtractor');

test('normalizeUrl adds https when protocol is missing', () => {
  assert.equal(normalizeUrl('example.com'), 'https://example.com');
  assert.equal(normalizeUrl('http://example.com'), 'http://example.com');
});

test('limitText keeps bounded text and marks truncation', () => {
  const result = limitText('abcdef', 4);

  assert.equal(result, 'abcd\n[truncated]');
});

test('formatWebsiteContext includes rendered text, html, links, script tags, inline scripts, and js responses', () => {
  const context = formatWebsiteContext({
    url: 'https://example.com',
    finalUrl: 'https://example.com/home',
    title: 'Example',
    metaDescription: 'A rendered app',
    visibleText: 'Rendered headline from client JavaScript',
    renderedHtml: '<main><h1>Rendered headline from client JavaScript</h1><script src="/app.js"></script></main>',
    links: [{ text: 'Pricing', href: 'https://example.com/pricing' }],
    scriptTags: [
      { src: 'https://example.com/app.js', type: 'external' },
      { type: 'inline', content: 'window.__APP_STATE__ = { loaded: true };' }
    ],
    jsResponses: [
      { url: 'https://example.com/app.js', status: 200, body: 'const hydrated = true;' }
    ],
    diagnostics: {
      scriptTagCount: 2,
      jsResponseCount: 1,
      linkCount: 1
    }
  }, { maxTotalChars: 3000 });

  assert.match(context, /Rendered headline from client JavaScript/);
  assert.match(context, /<script src="\/app\.js">/);
  assert.match(context, /window\.__APP_STATE__/);
  assert.match(context, /const hydrated = true/);
  assert.match(context, /Pricing -> https:\/\/example\.com\/pricing/);
  assert.ok(context.length <= 3000);
});

test('extractWebsiteFrontend waits for snapshot collection before closing the browser', async () => {
  let browserClosed = false;
  const fakePage = {
    on() {},
    async goto() {},
    async waitForTimeout() {},
    async evaluate() {
      await new Promise(resolve => setImmediate(resolve));
      if (browserClosed) {
        throw new Error('browser closed before evaluate finished');
      }

      return {
        url: 'https://example.com',
        finalUrl: 'https://example.com',
        title: 'Example',
        metaDescription: '',
        visibleText: 'Rendered text',
        renderedHtml: '<html></html>',
        links: [],
        scriptTags: [],
        diagnostics: { linkCount: 0, scriptTagCount: 0 }
      };
    }
  };

  const snapshot = await extractWebsiteFrontend('example.com', {
    chromium: {
      async launch() {
        return {
          async newContext() {
            return {
              async newPage() {
                return fakePage;
              }
            };
          },
          async close() {
            browserClosed = true;
          }
        };
      }
    }
  });

  assert.equal(snapshot.title, 'Example');
  assert.equal(browserClosed, true);
});

test('extractWebsiteFrontend waits for delayed JavaScript response bodies', async () => {
  const handlers = {};
  const fakePage = {
    on(event, handler) {
      handlers[event] = handler;
    },
    async goto() {
      handlers.response({
        request() {
          return { resourceType: () => 'script' };
        },
        headers() {
          return { 'content-type': 'application/javascript' };
        },
        url() {
          return 'https://example.com/app.js';
        },
        status() {
          return 200;
        },
        async text() {
          await new Promise(resolve => setTimeout(resolve, 25));
          return 'window.__delayedBundleLoaded = true;';
        }
      });
    },
    async waitForTimeout() {},
    async evaluate() {
      return {
        url: 'https://example.com',
        finalUrl: 'https://example.com',
        title: 'Example',
        metaDescription: '',
        visibleText: 'Rendered text',
        renderedHtml: '<html></html>',
        links: [],
        scriptTags: [],
        diagnostics: { linkCount: 0, scriptTagCount: 0 }
      };
    }
  };

  const snapshot = await extractWebsiteFrontend('example.com', {
    chromium: {
      async launch() {
        return {
          async newContext() {
            return {
              async newPage() {
                return fakePage;
              }
            };
          },
          async close() {}
        };
      }
    }
  });

  assert.equal(snapshot.diagnostics.jsResponseCount, 1);
  assert.match(snapshot.jsResponses[0].body, /delayedBundleLoaded/);
});
