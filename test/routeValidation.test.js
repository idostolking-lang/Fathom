const assert = require('node:assert/strict');
const express = require('express');
const path = require('node:path');
const test = require('node:test');

const { createInstagramRoutes } = require('../src/routes/instagramRoutes');
const { createWhatsAppRoutes } = require('../src/routes/whatsappRoutes');

const projectRoot = path.resolve(__dirname, '..');

function listen(app) {
  return new Promise(resolve => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function withServer(app, callback) {
  const server = await listen(app);
  try {
    const { port } = server.address();
    return await callback(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
  }
}

function createTaskManagerStub() {
  return {
    controlledDelay: async () => {},
    waitIfPausedOrCancelled: async () => {}
  };
}

test('WhatsApp send validates required fields before readiness state', async () => {
  const app = express();
  app.use(express.json());
  app.use('/api', createWhatsAppRoutes({ taskManager: createTaskManagerStub(), projectRoot }).router);

  await withServer(app, async baseUrl => {
    const response = await fetch(`${baseUrl}/api/whatsapp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.error, /Phone and message are required/);
  });
});

test('Instagram message route validates message template before readiness state', async () => {
  const app = express();
  app.use(express.json());
  app.use('/api', createInstagramRoutes({
    taskManager: createTaskManagerStub(),
    port: 0,
    accessToken: 'test-token'
  }));

  await withServer(app, async baseUrl => {
    const response = await fetch(`${baseUrl}/api/instagram/search-and-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.error, /Message template is required/);
  });
});

test('Instagram search-only route validates search query before readiness state', async () => {
  const app = express();
  app.use(express.json());
  app.use('/api', createInstagramRoutes({
    taskManager: createTaskManagerStub(),
    port: 0,
    accessToken: 'test-token'
  }));

  await withServer(app, async baseUrl => {
    const response = await fetch(`${baseUrl}/api/instagram/search-only`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.error, /Search query is required/);
  });
});
