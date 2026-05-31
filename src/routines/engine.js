// Routine engine: runs a saved pipeline as a tracked background task.
// Each step receives the previous step's working set (an array of business
// rows) and returns the next one. Progress, logs, and run history are recorded
// against both the in-memory taskManager (live UI) and SQLite (durable history).
const taskManager = require('../tasks/taskManager');
const store = require('../../lib/store');
const steps = require('../../lib/steps');

const HANDLERS = {
  discover: (rows, cfg, ctx) => steps.discover(cfg, ctx),
  filter: (rows, cfg, ctx) => steps.filter(rows, cfg, ctx),
  enrich: (rows, cfg, ctx) => steps.enrich(rows, cfg, ctx),
  analyze: (rows, cfg, ctx) => steps.analyze(rows, cfg, ctx),
  send_email: (rows, cfg, ctx) => steps.sendEmail(rows, cfg, ctx),
  send_whatsapp: (rows, cfg, ctx) => steps.sendWhatsapp(rows, cfg, ctx),
  send_sms: (rows, cfg, ctx) => steps.sendSms(rows, cfg, ctx),
  save: (rows, cfg, ctx) => steps.save(rows, cfg, ctx)
};

class RoutineEngine {
  constructor({ openai = null, whatsappSend = null, notify = null } = {}) {
    this.openai = openai;
    this.whatsappSend = whatsappSend;
    this.notify = notify;
  }

  // Kicks off a run and returns immediately with its identifiers.
  start(routine, { trigger = 'manual' } = {}) {
    const task = taskManager.createTask('routine', `Routine: ${routine.name}`, { routineId: routine.id });
    const run = store.runs.create({ routineId: routine.id, taskId: task.id, trigger });
    this._execute(routine, task.id, run.id).catch((err) => {
      taskManager.failTask(task.id, err);
      store.runs.finish(run.id, { status: 'error', error: err.message });
      if (this.notify) { try { this.notify({ routine, status: 'error', error: err.message }); } catch (e) { /* ignore */ } }
    });
    return { taskId: task.id, runId: run.id };
  }

  async _execute(routine, taskId, runId) {
    const pipeline = Array.isArray(routine.steps) ? routine.steps : [];
    const isCancelled = () => !taskManager.getTask(taskId);
    let rows = [];

    taskManager.updateTaskStatus(taskId, 'running', `Starting ${routine.name}`);
    store.runs.log(runId, `Run started (${pipeline.length} steps)`, 'info');

    for (let i = 0; i < pipeline.length; i++) {
      if (isCancelled()) { store.runs.finish(runId, { status: 'cancelled' }); return; }

      const step = pipeline[i] || {};
      const type = step.type;
      const cfg = step.config || {};
      const base = Math.floor((i / pipeline.length) * 100);
      const span = Math.floor(100 / pipeline.length);

      const ctx = {
        openai: this.openai,
        whatsappSend: this.whatsappSend,
        isCancelled,
        onProgress: (p, msg) =>
          taskManager.updateTaskProgress(taskId, Math.min(99, base + Math.floor((p / 100) * span)), `[${i + 1}/${pipeline.length}] ${msg}`),
        log: (msg, level = 'info') => { taskManager.addTaskLog(taskId, msg, level); store.runs.log(runId, msg, level); }
      };

      const handler = HANDLERS[type];
      if (!handler) { ctx.log(`Unknown step "${type}" skipped`, 'error'); continue; }

      ctx.log(`Step ${i + 1}/${pipeline.length}: ${type}`, 'info');
      const result = await handler(rows, cfg, ctx);
      if (Array.isArray(result)) rows = result;
      else if (result && Array.isArray(result.rows)) rows = result.rows;
      ctx.log(`Step ${i + 1} complete · ${rows.length} rows`, 'success');
    }

    const output = { rows: rows.length, sample: rows.slice(0, 5) };
    taskManager.completeTask(taskId, output);
    store.runs.finish(runId, { status: 'completed', output });
    if (this.notify) { try { this.notify({ routine, status: 'completed', output }); } catch (e) { /* ignore */ } }
  }
}

module.exports = { RoutineEngine };
