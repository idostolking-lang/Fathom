const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');
const splitAppScripts = [
  'public/js/app/scraper.js',
  'public/js/app/leads.js',
  'public/js/app/searchReports.js',
  'public/js/app/clipboard.js',
  'public/js/app/messageAnalysis.js',
  'public/js/app/instagram.js',
  'public/js/app/emailExtraction.js',
  'public/js/app/emailSender.js',
  'public/js/app/dashboardConsultant.js',
  'public/js/app/tableComparison.js'
];

function readFrontendBundle() {
  return splitAppScripts
    .map(file => fs.readFileSync(path.join(projectRoot, file), 'utf8'))
    .join('\n');
}

function readInstagramSource() {
  const routePath = path.join(projectRoot, 'src', 'routes', 'instagramRoutes.js');
  if (fs.existsSync(routePath)) {
    return fs.readFileSync(routePath, 'utf8');
  }

  return fs.readFileSync(path.join(projectRoot, 'server.js'), 'utf8');
}

function createFakeElement() {
  return {
    style: {},
    classList: {
      add() {},
      remove() {},
      toggle() {}
    },
    dataset: {},
    value: '',
    textContent: '',
    innerHTML: '',
    disabled: false,
    checked: false,
    addEventListener() {},
    appendChild() {},
    removeChild() {},
    click() {},
    querySelector() {
      return createFakeElement();
    },
    querySelectorAll() {
      return [];
    }
  };
}

function createBrowserSmokeContext(options = {}) {
  const elements = new Map();
  const missingIds = new Set(options.missingIds || []);
  const context = {
    console,
    Blob,
    Headers,
    URL,
    URLSearchParams,
    alert() {},
    confirm() { return true; },
    prompt() { return ''; },
    setInterval() { return 1; },
    clearInterval() {},
    setTimeout(callback) {
      if (typeof callback === 'function') callback();
      return 1;
    },
    fetch: async input => {
      const url = typeof input === 'string' ? input : input.url;
      if (String(url).includes('/api/tasks')) {
        return { ok: true, status: 200, json: async () => ({ success: true, tasks: [] }) };
      }

      return { ok: true, status: 200, json: async () => ({ success: true }) };
    },
    localStorage: {
      getItem() { return null; },
      setItem() {},
      removeItem() {}
    },
    document: {
      title: 'Data Scraper',
      body: createFakeElement(),
      createElement: createFakeElement,
      querySelector() {
        return createFakeElement();
      },
      querySelectorAll() {
        return [];
      },
      getElementById(id) {
        if (missingIds.has(id)) return null;
        if (!elements.has(id)) {
          elements.set(id, createFakeElement());
        }
        return elements.get(id);
      }
    }
  };

  context.window = context;
  context.location = { origin: 'http://localhost:7000', pathname: '/', search: '', hash: '', href: '' };
  context.history = { replaceState() {} };
  context.document.location = context.location;

  return vm.createContext(context);
}

test('auth fetch wrapper loads before frontend API callers', () => {
  const html = fs.readFileSync(path.join(projectRoot, 'public', 'index.html'), 'utf8');

  assert.ok(html.indexOf('js/authFetch.js') < html.indexOf('js/backgroundTasks.js'));

  const firstAppScript = html.includes('js/app/')
    ? html.indexOf('js/app/')
    : html.indexOf('app.js');
  assert.ok(html.indexOf('js/authFetch.js') < firstAppScript);
});

test('auth fetch shares one prompt across concurrent startup 401 responses', async () => {
  const source = fs.readFileSync(path.join(projectRoot, 'public/js/authFetch.js'), 'utf8');
  const requests = [];
  let storedToken = null;
  let promptCalls = 0;

  const context = vm.createContext({
    console,
    Headers,
    URL,
    URLSearchParams,
    document: { title: 'Data Scraper' },
    history: { replaceState() {} },
    location: {
      origin: 'http://localhost:7000',
      pathname: '/',
      search: '',
      hash: '',
      href: 'http://localhost:7000/'
    },
    localStorage: {
      getItem(key) {
        return key === 'dataScraperAccessToken' ? storedToken : null;
      },
      setItem(key, value) {
        if (key === 'dataScraperAccessToken') storedToken = value;
      },
      removeItem(key) {
        if (key === 'dataScraperAccessToken') storedToken = null;
      }
    },
    prompt() {
      promptCalls += 1;
      return promptCalls === 1 ? 'codex-token' : '';
    },
    fetch: async (input, init = {}) => {
      const headers = new Headers(init.headers || {});
      const token = headers.get('X-App-Access-Token');
      requests.push({ input, token });

      if (token === 'codex-token') {
        return { ok: true, status: 200, json: async () => ({ success: true }) };
      }

      return { ok: false, status: 401, json: async () => ({ success: false }) };
    }
  });

  context.window = context;

  vm.runInContext(source, context, { filename: 'js/authFetch.js' });

  const responses = await Promise.all([
    context.window.fetch('/api/tasks'),
    context.window.fetch('/api/whatsapp/status')
  ]);

  assert.equal(promptCalls, 1);
  assert.deepEqual(responses.map(response => response.status), [200, 200]);
  assert.equal(storedToken, 'codex-token');
  assert.deepEqual(requests.map(request => request.token), [null, null, 'codex-token', 'codex-token']);
});

test('foreground Instagram polling starts before the long send request is awaited', () => {
  const appJs = readFrontendBundle();
  const foregroundBlockStart = appJs.indexOf('// Normal foreground mode - show progress');
  const pollingIndex = appJs.indexOf('startProgressPolling();', foregroundBlockStart);
  const fetchIndex = appJs.indexOf("await fetch('/api/instagram/search-and-message'", foregroundBlockStart);

  assert.ok(foregroundBlockStart > -1);
  assert.ok(pollingIndex > -1);
  assert.ok(fetchIndex > -1);
  assert.ok(pollingIndex < fetchIndex);
});

test('split app scripts execute one file at a time in browser order', () => {
  const html = fs.readFileSync(path.join(projectRoot, 'public', 'index.html'), 'utf8');
  const scriptSources = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)]
    .map(match => match[1])
    .filter(src => src === 'js/authFetch.js' || src === 'js/backgroundTasks.js' || src.startsWith('js/app/'));
  const context = createBrowserSmokeContext();

  for (const scriptSource of scriptSources) {
    const source = fs.readFileSync(path.join(projectRoot, 'public', scriptSource), 'utf8');
    assert.doesNotThrow(
      () => vm.runInContext(source, context, { filename: scriptSource }),
      `${scriptSource} should execute without relying on later scripts`
    );
  }
});

test('scrape modal reset tolerates removed optional suggestion UI', () => {
  const context = createBrowserSmokeContext({
    missingIds: ['suggestionsContainer']
  });
  const source = fs.readFileSync(path.join(projectRoot, 'public/js/app/scraper.js'), 'utf8');

  vm.runInContext(source, context, { filename: 'js/app/scraper.js' });

  assert.doesNotThrow(() => vm.runInContext('resetModal()', context));
});

test('Instagram send loop checks task cancellation immediately before sending a DM', () => {
  const server = readInstagramSource();
  const sendIndex = server.indexOf('await thread.broadcastText(messageTemplate)');
  const preSendCheckIndex = server.lastIndexOf('await taskManager.waitIfPausedOrCancelled(backgroundTaskId);', sendIndex);
  const cancellationRethrowIndex = server.indexOf('isTaskCancellationError(error)', sendIndex);

  assert.ok(sendIndex > -1);
  assert.ok(preSendCheckIndex > -1);
  assert.ok(sendIndex - preSendCheckIndex < 200);
  assert.ok(cancellationRethrowIndex > sendIndex);
});

test('Instagram routes guard all shared client mutations during active automation', () => {
  const source = readInstagramSource();
  const activeGuardUsages = [...source.matchAll(/isActiveInstagramOperation\(currentInstagramOperation\)/g)].length;
  const connectIndex = source.indexOf("router.post('/instagram/connect'");
  const disconnectIndex = source.indexOf("router.post('/instagram/disconnect'");
  const searchMessageIndex = source.indexOf("router.post('/instagram/search-and-message'");
  const searchOnlyIndex = source.indexOf("router.post('/instagram/search-only'");

  assert.ok(connectIndex > -1);
  assert.ok(disconnectIndex > -1);
  assert.ok(searchMessageIndex > -1);
  assert.ok(searchOnlyIndex > -1);
  assert.ok(activeGuardUsages >= 4);
  assert.ok(source.indexOf('Instagram automation is already running', connectIndex) > connectIndex);
  assert.ok(source.indexOf('Instagram automation is already running', disconnectIndex) > disconnectIndex);
  assert.ok(source.indexOf('Instagram automation is already running', searchMessageIndex) > searchMessageIndex);
  assert.ok(source.indexOf('Instagram automation is already running', searchOnlyIndex) > searchOnlyIndex);
});
