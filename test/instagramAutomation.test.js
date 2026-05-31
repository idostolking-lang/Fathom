const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createInitialOperation,
  isActiveInstagramOperation,
  isInstagramStopSignal,
  isTaskCancellationError,
  parseSpecificAccounts,
  resolveInstagramSafetyRules,
  startInstagramBackgroundTask
} = require('../lib/instagramAutomation');

test('parseSpecificAccounts accepts commas, whitespace, @handles, URLs, and removes duplicates', () => {
  const accounts = parseSpecificAccounts(' @alpha, beta\nhttps://instagram.com/gamma/ @alpha delta ');

  assert.deepEqual(accounts, ['alpha', 'beta', 'gamma', 'delta']);
});

test('createInitialOperation clamps invalid totals to a useful pending operation', () => {
  const operation = createInitialOperation({ total: 0 });

  assert.equal(operation.status, 'starting');
  assert.equal(operation.progress, 0);
  assert.equal(operation.total, 1);
  assert.equal(operation.sent, 0);
  assert.equal(operation.failed, 0);
  assert.deepEqual(operation.logs, []);
});

test('resolveInstagramSafetyRules clamps risky batch and delay values', () => {
  const rules = resolveInstagramSafetyRules({
    maxAccounts: 200,
    minDelayMs: 1000,
    maxDelayMs: 2000,
    breakEvery: 99
  });

  assert.equal(rules.maxAccounts, 25);
  assert.equal(rules.minDelayMs, 15000);
  assert.equal(rules.maxDelayMs, 45000);
  assert.equal(rules.breakEvery, 3);
  assert.equal(rules.stopOnRateLimit, true);
});

test('resolveInstagramSafetyRules keeps conservative custom values inside limits', () => {
  const rules = resolveInstagramSafetyRules({
    maxAccounts: 7,
    minDelayMs: 20000,
    maxDelayMs: 50000,
    breakEvery: 2
  });

  assert.equal(rules.maxAccounts, 7);
  assert.equal(rules.minDelayMs, 20000);
  assert.equal(rules.maxDelayMs, 50000);
  assert.equal(rules.breakEvery, 2);
});

test('isInstagramStopSignal detects platform challenge and rate-limit messages case-insensitively', () => {
  assert.equal(isInstagramStopSignal(new Error('feedback_required')), true);
  assert.equal(isInstagramStopSignal(new Error('Please wait a few minutes before you try again.')), true);
  assert.equal(isInstagramStopSignal(new Error('CHECKPOINT_REQUIRED')), true);
  assert.equal(isInstagramStopSignal(new Error('challenge_required')), true);
  assert.equal(isInstagramStopSignal(new Error('temporary spam block')), true);
  assert.equal(isInstagramStopSignal(new Error('network socket closed')), false);
});

test('isActiveInstagramOperation only treats running states as active', () => {
  assert.equal(isActiveInstagramOperation({ status: 'starting' }), true);
  assert.equal(isActiveInstagramOperation({ status: 'searching' }), true);
  assert.equal(isActiveInstagramOperation({ status: 'messaging' }), true);
  assert.equal(isActiveInstagramOperation({ status: 'completed' }), false);
  assert.equal(isActiveInstagramOperation({ status: 'error' }), false);
  assert.equal(isActiveInstagramOperation(null), false);
});

test('startInstagramBackgroundTask returns immediately and completes task asynchronously', async () => {
  const events = [];
  const taskManager = {
    createTask(type, description, data) {
      events.push(['create', type, description, data]);
      return { id: 'task_1' };
    },
    addTaskLog(taskId, message, type) {
      events.push(['log', taskId, message, type]);
    },
    updateTaskProgress(taskId, progress, message) {
      events.push(['progress', taskId, progress, message]);
    },
    completeTask(taskId, result) {
      events.push(['complete', taskId, result.sent]);
    },
    failTask(taskId, error) {
      events.push(['fail', taskId, error]);
    }
  };

  const runner = async () => ({ sent: 1, failed: 0, totalFound: 1, results: [] });

  const response = startInstagramBackgroundTask({
    taskManager,
    params: { specificAccounts: ['alpha'], maxAccounts: 1 },
    runner
  });

  assert.deepEqual(response, { success: true, taskId: 'task_1' });

  await new Promise(resolve => setImmediate(resolve));

  assert.equal(events[0][0], 'create');
  assert.deepEqual(events.find(event => event[0] === 'complete'), ['complete', 'task_1', 1]);
});

test('isTaskCancellationError detects task cancellation errors', () => {
  assert.equal(isTaskCancellationError(new Error('Task task_1 was cancelled')), true);
  assert.equal(isTaskCancellationError(new Error('rate limited')), false);
});
