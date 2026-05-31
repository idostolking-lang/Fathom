const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('server entrypoint is a thin startup shim without inline route definitions', () => {
  const server = read('server.js');
  const lines = server.split(/\r?\n/).filter(line => line.trim().length > 0);

  assert.ok(lines.length <= 12, `server.js should stay small, found ${lines.length} non-empty lines`);
  assert.match(server, /require\(['"]\.\/src\/server\/start['"]\)/);
  assert.doesNotMatch(server, /\bapp\.(get|post|put|delete|patch)\s*\(/);
});

test('server.js is the only JavaScript file at the project root', () => {
  const rootScripts = fs.readdirSync(projectRoot, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.js'))
    .map(entry => entry.name)
    .sort();

  assert.deepEqual(rootScripts, ['server.js']);
});

test('backend route families live in dedicated src/routes modules', () => {
  const expectedRoutes = [
    'src/routes/aiRoutes.js',
    'src/routes/emailRoutes.js',
    'src/routes/instagramRoutes.js',
    'src/routes/scrapingRoutes.js',
    'src/routes/whatsappRoutes.js'
  ];

  for (const routeFile of expectedRoutes) {
    assert.ok(fs.existsSync(path.join(projectRoot, routeFile)), `${routeFile} should exist`);
  }
});

test('route modules do not define duplicate method/path pairs', () => {
  const routeDir = path.join(projectRoot, 'src', 'routes');
  const routeFiles = fs.readdirSync(routeDir)
    .filter(file => file.endsWith('.js'))
    .map(file => path.join(routeDir, file));
  const seen = new Map();
  const duplicates = [];
  const routePattern = /router\.(get|post|put|delete|patch)\('([^']+)'/g;

  for (const routeFile of routeFiles) {
    const source = fs.readFileSync(routeFile, 'utf8');
    for (const match of source.matchAll(routePattern)) {
      const key = `${match[1].toUpperCase()} ${match[2]}`;
      const owner = path.relative(projectRoot, routeFile);
      if (seen.has(key)) {
        duplicates.push(`${key}: ${seen.get(key)} and ${owner}`);
      } else {
        seen.set(key, owner);
      }
    }
  }

  assert.deepEqual(duplicates, []);
});

test('WhatsApp route module does not depend on OpenAI message generation', () => {
  const whatsappRoutes = read('src/routes/whatsappRoutes.js');

  assert.doesNotMatch(whatsappRoutes, /router\.post\('\/generate-message'/);
  assert.doesNotMatch(whatsappRoutes, /\bopenai\b/);
});

test('frontend app code is split into ordered feature scripts', () => {
  const html = read('public/index.html');
  const expectedScripts = [
    'js/authFetch.js',
    'js/backgroundTasks.js',
    'js/app/scraper.js',
    'js/app/leads.js',
    'js/app/searchReports.js',
    'js/app/clipboard.js',
    'js/app/messageAnalysis.js',
    'js/app/instagram.js',
    'js/app/emailExtraction.js',
    'js/app/emailSender.js',
    'js/app/dashboardConsultant.js',
    'js/app/tableComparison.js'
  ];

  assert.equal(html.includes('src="app.js"'), false, 'index.html should not load the monolithic app.js');

  let previousIndex = -1;
  for (const script of expectedScripts) {
    const index = html.indexOf(`src="${script}"`);
    assert.ok(index > previousIndex, `${script} should load after the previous app script`);
    assert.ok(fs.existsSync(path.join(projectRoot, 'public', script)), `${script} should exist`);
    previousIndex = index;
  }
});

test('public root does not contain JavaScript files', () => {
  const publicRootScripts = fs.readdirSync(path.join(projectRoot, 'public'), { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.js'))
    .map(entry => entry.name)
    .sort();

  assert.deepEqual(publicRootScripts, []);
});

test('root markdown files are limited to open-source entry docs', () => {
  const allowedRootMarkdown = new Set(['README.md', 'SECURITY.md', 'SETUP.md']);
  const rootMarkdown = fs.readdirSync(projectRoot)
    .filter(file => file.endsWith('.md'))
    .sort();

  assert.deepEqual(rootMarkdown, [...allowedRootMarkdown].sort());
});
