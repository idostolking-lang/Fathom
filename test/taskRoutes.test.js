const assert = require('node:assert/strict');
const express = require('express');
const test = require('node:test');

const taskRoutes = require('../src/tasks/taskRoutes');

function listen(app) {
  return new Promise(resolve => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
}

test('task statistics route is matched before task id route', async () => {
  const app = express();
  app.use('/api', taskRoutes);
  const server = await listen(app);

  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/tasks/stats/summary`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.ok(body.statistics);
  } finally {
    server.close();
  }
});
