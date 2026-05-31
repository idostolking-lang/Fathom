const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '..');

function readInstagramSource() {
  const routePath = path.join(projectRoot, 'src', 'routes', 'instagramRoutes.js');
  if (fs.existsSync(routePath)) {
    return fs.readFileSync(routePath, 'utf8');
  }

  return fs.readFileSync(path.join(projectRoot, 'server.js'), 'utf8');
}

test('instagram-private-api is not installed by default dependency graph', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  const packageLock = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package-lock.json'), 'utf8'));

  assert.equal(packageJson.dependencies?.['instagram-private-api'], undefined);
  assert.equal(packageJson.optionalDependencies?.['instagram-private-api'], undefined);
  assert.equal(packageLock.packages?.['node_modules/instagram-private-api'], undefined);
});

test('Instagram dependency is loaded lazily at runtime', () => {
  const server = readInstagramSource();
  const topLevelRequire = /const\s+\{?\s*IgApiClient[\s\S]{0,80}require\(['"]instagram-private-api['"]\)/;

  assert.doesNotMatch(server, topLevelRequire);
  assert.match(server, /function loadInstagramApiClient\(\)/);
  assert.match(server, /npm install instagram-private-api/);
});

test('Instagram automation is disabled by default in env example and does not ask for password storage', () => {
  const envExample = fs.readFileSync(path.join(projectRoot, '.env.example'), 'utf8');

  assert.match(envExample, /^ENABLE_INSTAGRAM_AUTOMATION=false$/m);
  assert.doesNotMatch(envExample, /^INSTAGRAM_USERNAME=/m);
  assert.doesNotMatch(envExample, /^INSTAGRAM_PASSWORD=/m);
});
