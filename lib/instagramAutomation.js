function normalizeUsername(value) {
  if (!value) return '';

  let username = String(value).trim();
  username = username.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '');
  username = username.split(/[/?#]/)[0];
  username = username.replace(/^@+/, '');
  username = username.trim();

  if (!/^[A-Za-z0-9._]+$/.test(username)) {
    return '';
  }

  return username;
}

function parseSpecificAccounts(input) {
  const rawItems = Array.isArray(input)
    ? input
    : String(input || '').split(/[\s,;]+/);

  const seen = new Set();
  const accounts = [];

  for (const item of rawItems) {
    const username = normalizeUsername(item);
    const key = username.toLowerCase();

    if (!username || seen.has(key)) continue;

    seen.add(key);
    accounts.push(username);
  }

  return accounts;
}

function createInitialOperation({ total } = {}) {
  const parsedTotal = Number.parseInt(total, 10);

  return {
    status: 'starting',
    progress: 0,
    total: Number.isInteger(parsedTotal) && parsedTotal > 0 ? parsedTotal : 1,
    sent: 0,
    failed: 0,
    current: null,
    logs: []
  };
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveInstagramSafetyRules(input = {}) {
  const requestedMaxAccounts = parsePositiveInteger(input.maxAccounts, 10);
  const requestedMinDelay = parsePositiveInteger(input.minDelayMs, 15000);
  const requestedMaxDelay = parsePositiveInteger(input.maxDelayMs, 45000);
  const requestedBreakEvery = parsePositiveInteger(input.breakEvery, 3);

  const minDelayMs = Math.max(requestedMinDelay, 15000);
  const maxDelayMs = Math.max(requestedMaxDelay, minDelayMs + 5000, 45000);
  const breakEvery = requestedBreakEvery >= 1 && requestedBreakEvery <= 5
    ? requestedBreakEvery
    : 3;

  return {
    maxAccounts: Math.min(requestedMaxAccounts, 25),
    minDelayMs,
    maxDelayMs,
    breakEvery,
    breakMinMs: 60000,
    breakMaxMs: 180000,
    stopOnRateLimit: true
  };
}

function isInstagramStopSignal(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return [
    'rate',
    'spam',
    'feedback_required',
    'checkpoint_required',
    'challenge_required',
    'please wait',
    'try again later',
    'temporarily blocked',
    'action blocked'
  ].some(pattern => message.includes(pattern));
}

function isActiveInstagramOperation(operation) {
  return ['starting', 'searching', 'messaging'].includes(operation?.status);
}

function startInstagramBackgroundTask({ taskManager, params, runner }) {
  const task = taskManager.createTask(
    'instagram',
    `Instagram: ${(params.searchQuery || params.specificAccounts || 'manual accounts').toString().substring(0, 60)}`,
    params
  );

  setImmediate(async () => {
    try {
      taskManager.addTaskLog(task.id, 'Instagram automation started in background', 'info');
      taskManager.updateTaskProgress(task.id, 1, 'Starting Instagram automation...');

      const result = await runner({ taskId: task.id, params });

      taskManager.completeTask(task.id, result);
    } catch (error) {
      taskManager.failTask(task.id, error.message || String(error));
    }
  });

  return {
    success: true,
    taskId: task.id
  };
}

function isTaskCancellationError(error) {
  return Boolean(error && /was cancelled/i.test(error.message || String(error)));
}

module.exports = {
  createInitialOperation,
  isActiveInstagramOperation,
  isInstagramStopSignal,
  isTaskCancellationError,
  normalizeUsername,
  parseSpecificAccounts,
  resolveInstagramSafetyRules,
  startInstagramBackgroundTask
};
