const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '..');
const scannedExtensions = new Set(['.js', '.json', '.html', '.css', '.md']);
const ignoredDirs = new Set(['node_modules', '.git', '.wwebjs_auth', '.wwebjs_cache']);

function collectFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (ignoredDirs.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath));
      continue;
    }

    if (scannedExtensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function readSourceFiles() {
  return collectFiles(projectRoot).map(filePath => ({
    filePath,
    relativePath: path.relative(projectRoot, filePath),
    content: fs.readFileSync(filePath, 'utf8')
  }));
}

test('browser code does not pin API calls to localhost:3000', () => {
  const offenders = readSourceFiles()
    .filter(file => file.relativePath.startsWith('public' + path.sep))
    .filter(file => file.content.includes('http://localhost:3000/api/'))
    .map(file => file.relativePath);

  assert.deepEqual(offenders, []);
});

test('source files do not contain hardcoded OpenAI-style secret keys', () => {
  const secretPattern = /sk-(?:proj-)?[A-Za-z0-9_-]{24,}/g;
  const offenders = readSourceFiles()
    .filter(file => file.relativePath !== 'package-lock.json')
    .flatMap(file => {
      const matches = file.content.match(secretPattern) || [];
      return matches.map(() => file.relativePath);
    });

  assert.deepEqual([...new Set(offenders)], []);
});

test('published source files do not contain mojibake text artifacts', () => {
  const mojibakePattern = new RegExp('[\\u00c3\\u00c2\\u00e2\\u00f0\\u00ef\\u00d7][\\u0080-\\u00ff\\u0152\\u0153\\u0160\\u0161\\u0178\\u017d\\u017e\\u0192\\u02c6\\u02dc\\u20ac\\u2013-\\u201e\\u2020-\\u2026\\u2030\\u2039\\u203a\\u2122]');
  const ignoredDocPrefixes = [
    `docs${path.sep}archive${path.sep}`,
    `docs${path.sep}superpowers${path.sep}`
  ];
  const offenders = readSourceFiles()
    .filter(file => !ignoredDocPrefixes.some(prefix => file.relativePath.startsWith(prefix)))
    .filter(file => file.relativePath !== 'package-lock.json')
    .filter(file => mojibakePattern.test(file.content))
    .map(file => file.relativePath);

  assert.deepEqual(offenders, []);
});

test('runtime secrets and browser sessions are ignored while env example is trackable', () => {
  const gitignore = fs.readFileSync(path.join(projectRoot, '.gitignore'), 'utf8');

  assert.match(gitignore, /^\.env(?:\r?\n|$)/m);
  assert.match(gitignore, /^!\.env\.example(?:\r?\n|$)/m);
  assert.match(gitignore, /^\.wwebjs_auth\/(?:\r?\n|$)/m);
  assert.match(gitignore, /^\.wwebjs_cache\/(?:\r?\n|$)/m);
  assert.match(gitignore, /^docs\/archive\/(?:\r?\n|$)/m);
  assert.match(gitignore, /^docs\/superpowers\/(?:\r?\n|$)/m);
});

test('npm package dry run excludes local secrets, sessions, dependencies, and logs', () => {
  const output = childProcess.execSync('npm pack --dry-run --json', {
    cwd: projectRoot,
    encoding: 'utf8'
  });
  const [pack] = JSON.parse(output);
  const packageFiles = pack.files.map(file => file.path.replaceAll('\\', '/'));

  assert.ok(packageFiles.includes('.env.example'));
  assert.ok(packageFiles.includes('public/js/authFetch.js'));
  assert.ok(packageFiles.includes('src/server/createApp.js'));
  assert.deepEqual(packageFiles.filter(file => /^[^/]+\.js$/.test(file)), ['server.js']);
  assert.ok(packageFiles.every(file => !/^public\/[^/]+\.js$/.test(file)));
  assert.ok(packageFiles.every(file => file !== '.env'));
  assert.ok(packageFiles.every(file => !file.startsWith('.wwebjs_auth/')));
  assert.ok(packageFiles.every(file => !file.startsWith('.wwebjs_cache/')));
  assert.ok(packageFiles.every(file => !file.startsWith('node_modules/')));
  assert.ok(packageFiles.every(file => !file.startsWith('docs/archive/')));
  assert.ok(packageFiles.every(file => !file.startsWith('docs/superpowers/')));
  assert.ok(packageFiles.every(file => !file.endsWith('.log')));
});

test('public webroot does not include development-only test utilities', () => {
  const publicFiles = collectFiles(path.join(projectRoot, 'public'))
    .map(file => path.relative(projectRoot, file).replaceAll('\\', '/'));

  assert.ok(publicFiles.every(file => file !== 'public/create-test-table.html'));
  assert.ok(publicFiles.every(file => !/\/create-test-|\/test-|\/dev-/i.test(file)));
});

test('startup logs do not disclose configured account identities', () => {
  const startSource = fs.readFileSync(path.join(projectRoot, 'src/server/start.js'), 'utf8');

  assert.doesNotMatch(startSource, /Email sender configured:\s*\$\{process\.env\.EMAIL_USER\}/);
});

test('security notes warn about arbitrary website extraction exposure', () => {
  const securityNotes = fs.readFileSync(path.join(projectRoot, 'SECURITY.md'), 'utf8');

  assert.match(securityNotes, /SSRF/i);
  assert.match(securityNotes, /user-supplied URLs/i);
  assert.match(securityNotes, /Tailscale/i);
});

test('packaged docs do not overpromise Instagram automation safety', () => {
  const docsRoot = path.join(projectRoot, 'docs', 'guides');
  const docs = collectFiles(docsRoot)
    .filter(file => file.endsWith('.md'))
    .map(file => fs.readFileSync(file, 'utf8'))
    .join('\n');

  assert.doesNotMatch(docs, /100% accuracy/i);
  assert.doesNotMatch(docs, /prevents Instagram from detecting automation/i);
  assert.doesNotMatch(docs, /Instagram Followers Bot/i);
  assert.doesNotMatch(docs, /Maintain Following List/i);
});
