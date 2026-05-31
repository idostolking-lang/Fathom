const assert = require('node:assert/strict');
const test = require('node:test');

const { createConfig, requireConfigValue } = require('../lib/config');

test('createConfig defaults to port 7000 and host 0.0.0.0', () => {
  const config = createConfig({});

  assert.equal(config.port, 7000);
  assert.equal(config.host, '0.0.0.0');
  assert.equal(config.nodeEnv, 'development');
});

test('createConfig allows environment overrides', () => {
  const config = createConfig({
    PORT: '7777',
    HOST: '127.0.0.1',
    NODE_ENV: 'test'
  });

  assert.equal(config.port, 7777);
  assert.equal(config.host, '127.0.0.1');
  assert.equal(config.nodeEnv, 'test');
});

test('requireConfigValue rejects missing integration secrets without a fallback', () => {
  assert.throws(
    () => requireConfigValue({}, 'OPENAI_API_KEY', 'OpenAI API key is required'),
    /OpenAI API key is required/
  );
});
