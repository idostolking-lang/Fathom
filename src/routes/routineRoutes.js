// Routine API: CRUD for pipelines, manual runs, run history, and schedules.
const express = require('express');
const store = require('../../lib/store');
const { nextRun } = require('../routines/cron');

function createRoutineRoutes({ engine }) {
  const router = express.Router();

  const ok = (res, payload) => res.json({ success: true, ...payload });
  const fail = (res, code, error) => res.status(code).json({ success: false, error });
  const wrap = (handler) => (req, res) => {
    try { handler(req, res); }
    catch (err) { fail(res, 500, err.message || 'Server error'); }
  };

  // ---- routine CRUD ----
  router.get('/routines', wrap((req, res) => ok(res, { routines: store.routines.list() })));

  router.get('/routines/:id', wrap((req, res) => {
    const routine = store.routines.get(Number(req.params.id));
    if (!routine) return fail(res, 404, 'Routine not found');
    return ok(res, { routine, schedules: store.schedules.forRoutine(routine.id), runs: store.runs.listForRoutine(routine.id, 10) });
  }));

  router.post('/routines', wrap((req, res) => {
    const { name, description, steps, enabled } = req.body || {};
    if (!name) return fail(res, 400, 'name is required');
    return ok(res, { routine: store.routines.create({ name, description, steps, enabled }) });
  }));

  router.put('/routines/:id', wrap((req, res) => {
    const routine = store.routines.update(Number(req.params.id), req.body || {});
    return routine ? ok(res, { routine }) : fail(res, 404, 'Routine not found');
  }));

  router.delete('/routines/:id', wrap((req, res) => ok(res, { deleted: store.routines.remove(Number(req.params.id)) })));

  // ---- run a routine now ----
  router.post('/routines/:id/run', wrap((req, res) => {
    const routine = store.routines.get(Number(req.params.id));
    if (!routine) return fail(res, 404, 'Routine not found');
    if (!routine.steps.length) return fail(res, 400, 'Routine has no steps');
    const { taskId, runId } = engine.start(routine, { trigger: 'manual' });
    return ok(res, { taskId, runId });
  }));

  // ---- run history ----
  router.get('/routines/:id/runs', wrap((req, res) =>
    ok(res, { runs: store.runs.listForRoutine(Number(req.params.id), 50) })));

  router.get('/runs/:runId', wrap((req, res) => {
    const run = store.runs.get(Number(req.params.runId));
    if (!run) return fail(res, 404, 'Run not found');
    return ok(res, { run, logs: store.runs.logs(run.id) });
  }));

  // ---- schedules ----
  router.get('/schedules', wrap((req, res) => ok(res, { schedules: store.schedules.list() })));

  router.post('/routines/:id/schedule', wrap((req, res) => {
    const routine = store.routines.get(Number(req.params.id));
    if (!routine) return fail(res, 404, 'Routine not found');
    const { cron } = req.body || {};
    if (!cron) return fail(res, 400, 'cron is required');
    let next = null;
    try { next = nextRun(cron, new Date()); }
    catch (err) { return fail(res, 400, err.message); }
    const schedule = store.schedules.create({ routineId: routine.id, cron, nextRunAt: next ? next.toISOString() : null });
    return ok(res, { schedule });
  }));

  router.delete('/schedules/:id', wrap((req, res) => ok(res, { deleted: store.schedules.remove(Number(req.params.id)) })));

  return router;
}

module.exports = { createRoutineRoutes };
