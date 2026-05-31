const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createAccessMiddleware,
  createCorsOptions,
  extractAccessToken,
  getAccessToken,
  isPrivateOrTailscaleHost,
  validateAccessConfiguration
} = require('../lib/accessControl');

test('validateAccessConfiguration requires a token when binding outside loopback', () => {
  assert.throws(
    () => validateAccessConfiguration({ host: '0.0.0.0', sessionSecret: 'not-enough' }),
    /APP_ACCESS_TOKEN is required/
  );
});

test('getAccessToken does not fall back to session secret', () => {
  assert.equal(getAccessToken({ appAccessToken: 'dashboard-token', sessionSecret: 'session-token' }), 'dashboard-token');
  assert.equal(getAccessToken({ sessionSecret: 'session-token' }), '');
});

test('validateAccessConfiguration allows loopback development without a token', () => {
  assert.equal(validateAccessConfiguration({ host: '127.0.0.1' }), '');
});

test('extractAccessToken reads custom header or bearer token, not query string tokens', () => {
  assert.equal(extractAccessToken({ headers: { 'x-app-access-token': 'abc' } }), 'abc');
  assert.equal(extractAccessToken({ headers: { authorization: 'Bearer def' } }), 'def');
  assert.equal(extractAccessToken({ query: { token: 'ghi', access_token: 'jkl' }, headers: {} }), '');
});

test('createAccessMiddleware rejects missing or invalid API tokens', () => {
  const middleware = createAccessMiddleware({ appAccessToken: 'secret' });
  const req = { method: 'POST', headers: {}, query: {} };
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };

  middleware(req, res, () => assert.fail('next should not be called'));

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, 'Access token required');
});

test('createAccessMiddleware allows valid API tokens', () => {
  const middleware = createAccessMiddleware({ appAccessToken: 'secret' });
  let called = false;

  middleware(
    { method: 'POST', headers: { 'x-app-access-token': 'secret' }, query: {} },
    {},
    () => {
      called = true;
    }
  );

  assert.equal(called, true);
});

test('cors options allow localhost and Tailscale origins but not arbitrary sites', async () => {
  const options = createCorsOptions({ port: 7000, allowedOrigins: '' });

  assert.equal(isPrivateOrTailscaleHost('100.105.98.98'), true);

  const decide = origin => new Promise(resolve => {
    options.origin(origin, (_error, allowed) => resolve(allowed));
  });

  assert.equal(await decide('http://localhost:7000'), true);
  assert.equal(await decide('http://100.105.98.98:7000'), true);
  assert.equal(await decide('https://example.com'), false);
});
