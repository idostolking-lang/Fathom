const DEFAULT_LIMITS = {
  maxVisibleTextChars: 20000,
  maxHtmlChars: 20000,
  maxInlineScriptChars: 2500,
  maxJsResponseChars: 5000,
  maxJsResponses: 12,
  maxLinks: 80,
  maxTotalChars: 60000,
  timeoutMs: 30000,
  settleMs: 2000
};

function normalizeUrl(value) {
  const url = String(value || '').trim();
  if (!url) {
    throw new Error('Website URL is required');
  }

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  return `https://${url}`;
}

function limitText(value, maxChars) {
  const text = String(value || '');
  if (!maxChars || text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, maxChars)}\n[truncated]`;
}

function limitTextToTotal(value, maxChars) {
  const text = String(value || '');
  const marker = '\n[truncated]';
  if (!maxChars || text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxChars - marker.length))}${marker}`;
}

function mergeLimits(options = {}) {
  return {
    ...DEFAULT_LIMITS,
    ...options
  };
}

function formatWebsiteContext(snapshot, options = {}) {
  const limits = mergeLimits(options);
  const links = (snapshot.links || [])
    .slice(0, limits.maxLinks)
    .map(link => `${link.text || '(no text)'} -> ${link.href}`)
    .join('\n');

  const scriptTags = (snapshot.scriptTags || [])
    .map((script, index) => {
      if (script.src) {
        return `${index + 1}. external ${script.src}`;
      }

      return `${index + 1}. inline ${limitText(script.content, limits.maxInlineScriptChars)}`;
    })
    .join('\n\n');

  const jsResponses = (snapshot.jsResponses || [])
    .slice(0, limits.maxJsResponses)
    .map((response, index) => [
      `${index + 1}. ${response.status || 'unknown'} ${response.url}`,
      limitText(response.body, limits.maxJsResponseChars)
    ].join('\n'))
    .join('\n\n');

  const diagnostics = snapshot.diagnostics
    ? JSON.stringify(snapshot.diagnostics, null, 2)
    : '{}';

  const context = [
    '# Website Frontend Snapshot',
    `URL: ${snapshot.url || ''}`,
    `Final URL: ${snapshot.finalUrl || snapshot.url || ''}`,
    `Title: ${snapshot.title || ''}`,
    `Meta Description: ${snapshot.metaDescription || ''}`,
    '',
    '## Diagnostics',
    diagnostics,
    '',
    '## Rendered Visible Text',
    limitText(snapshot.visibleText, limits.maxVisibleTextChars),
    '',
    '## Links',
    links || 'No links captured',
    '',
    '## Script Tags',
    scriptTags || 'No script tags captured',
    '',
    '## JavaScript Responses',
    jsResponses || 'No JavaScript responses captured',
    '',
    '## Rendered HTML',
    limitText(snapshot.renderedHtml, limits.maxHtmlChars)
  ].join('\n');

  return limitTextToTotal(context, limits.maxTotalChars);
}

async function collectSnapshotFromPage(page, targetUrl, jsResponses, options = {}) {
  const limits = mergeLimits(options);

  return page.evaluate((args) => {
    const normalizeSpace = value => String(value || '').replace(/\s+/g, ' ').trim();

    const links = Array.from(document.querySelectorAll('a[href]')).map(anchor => ({
      text: normalizeSpace(anchor.innerText || anchor.textContent || anchor.getAttribute('aria-label')),
      href: anchor.href
    }));

    const scriptTags = Array.from(document.querySelectorAll('script')).map(script => {
      if (script.src) {
        return {
          type: script.type || 'external',
          src: script.src
        };
      }

      return {
        type: script.type || 'inline',
        content: script.textContent || ''
      };
    });

    const metaDescription = document.querySelector('meta[name="description"], meta[property="og:description"]')?.content || '';

    return {
      url: args.targetUrl,
      finalUrl: window.location.href,
      title: document.title || '',
      metaDescription,
      visibleText: document.body?.innerText || '',
      renderedHtml: document.documentElement?.outerHTML || '',
      links,
      scriptTags,
      diagnostics: {
        linkCount: links.length,
        scriptTagCount: scriptTags.length
      }
    };
  }, { targetUrl, limits }).then(snapshot => ({
    ...snapshot,
    links: (snapshot.links || []).slice(0, limits.maxLinks),
    scriptTags: (snapshot.scriptTags || []).map(script => ({
      ...script,
      content: script.content ? limitText(script.content, limits.maxInlineScriptChars) : undefined
    })),
    jsResponses: jsResponses.slice(0, limits.maxJsResponses),
    diagnostics: {
      ...snapshot.diagnostics,
      jsResponseCount: jsResponses.length
    }
  }));
}

async function extractWebsiteFrontend(url, options = {}) {
  const limits = mergeLimits(options);
  const targetUrl = normalizeUrl(url);
  const playwright = options.playwright || require('playwright');
  const chromium = options.chromium || playwright.chromium;
  const jsResponses = [];
  const pendingJsResponseReads = [];
  let browser;

  try {
    browser = await chromium.launch({
      headless: true,
      ...(options.launchOptions || {})
    });

    const context = await browser.newContext({
      viewport: { width: 1440, height: 1200 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();

    page.on('response', response => {
      if (jsResponses.length >= limits.maxJsResponses) return;

      const request = response.request();
      const resourceType = request.resourceType();
      const contentType = response.headers()['content-type'] || '';
      const isJavaScript = resourceType === 'script' || /javascript|ecmascript/i.test(contentType);

      if (!isJavaScript) return;

      pendingJsResponseReads.push((async () => {
        try {
          const body = await response.text();
          jsResponses.push({
            url: response.url(),
            status: response.status(),
            body: limitText(body, limits.maxJsResponseChars)
          });
        } catch (_error) {
          jsResponses.push({
            url: response.url(),
            status: response.status(),
            body: '[body unavailable]'
          });
        }
      })());
    });

    await page.goto(targetUrl, {
      waitUntil: 'networkidle',
      timeout: limits.timeoutMs
    }).catch(error => {
      throw new Error(`Failed to load website with Playwright: ${error.message}`);
    });

    await page.waitForTimeout(limits.settleMs);
    await Promise.allSettled(pendingJsResponseReads);

    return await collectSnapshotFromPage(page, targetUrl, jsResponses, limits);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = {
  collectSnapshotFromPage,
  extractWebsiteFrontend,
  formatWebsiteContext,
  limitText,
  normalizeUrl
};
