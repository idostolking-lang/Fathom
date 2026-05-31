const assert = require('node:assert/strict');
const test = require('node:test');

const { BackgroundTaskManager } = require('../src/tasks/taskManager');

test('controlledDelay waits while a task is paused and resumes afterward', async () => {
  const manager = new BackgroundTaskManager();
  const task = manager.createTask('instagram', 'test');
  manager.pauseTask(task.id);

  let resolved = false;
  const delayPromise = manager.controlledDelay(task.id, 5, 1).then(() => {
    resolved = true;
  });

  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(resolved, false);

  manager.resumeTask(task.id);
  await delayPromise;

  assert.equal(resolved, true);
});

test('controlledDelay rejects when a task is deleted', async () => {
  const manager = new BackgroundTaskManager();
  const task = manager.createTask('instagram', 'test');
  const delayPromise = manager.controlledDelay(task.id, 100, 1);

  manager.deleteTask(task.id);

  await assert.rejects(delayPromise, /cancelled/);
});
