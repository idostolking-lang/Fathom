const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('send-email endpoint uses Nodemailer createTransport API', () => {
  const routePath = path.resolve(__dirname, '..', 'src', 'routes', 'emailRoutes.js');
  const sourcePath = fs.existsSync(routePath)
    ? routePath
    : path.resolve(__dirname, '..', 'server.js');
  const server = fs.readFileSync(sourcePath, 'utf8');

  assert.match(server, /nodemailer\.createTransport\(/);
  assert.doesNotMatch(server, /nodemailer\.createTransporter\(/);
});
