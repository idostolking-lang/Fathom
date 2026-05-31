const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '..');

test('Instagram result rendering escapes profile-controlled fields before innerHTML', () => {
  const source = fs.readFileSync(path.join(projectRoot, 'public', 'js', 'app', 'instagram.js'), 'utf8');

  assert.match(source, /function escapeHtml\(/);
  assert.match(source, /const safeUsername = escapeHtml\(account\.username\)/);
  assert.match(source, /const safeFullName = escapeHtml\(account\.fullName\)/);
  assert.match(source, /const safeBiography = escapeHtml\(/);
  assert.match(source, /const safeStatusText = escapeHtml\(statusText\)/);
  assert.doesNotMatch(source, /\$\{account\.fullName\}/);
  assert.doesNotMatch(source, /\$\{account\.biography/);
});
