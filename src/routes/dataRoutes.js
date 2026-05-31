// CRUD API for persisted data (saved tables, reports, analyses, presets,
// consultant chats, clipboard, cost tracking). Thin HTTP layer over lib/store.
const express = require('express');
const store = require('../../lib/store');

function createDataRoutes() {
  const router = express.Router();

  const ok = (res, payload) => res.json({ success: true, ...payload });
  const fail = (res, code, error) => res.status(code).json({ success: false, error });
  const wrap = (handler) => (req, res) => {
    try { handler(req, res); }
    catch (err) { fail(res, 500, err.message || 'Server error'); }
  };

  // ---- saved tables ----
  router.get('/tables', wrap((req, res) => ok(res, { tables: store.tables.list() })));
  router.get('/tables/:id', wrap((req, res) => {
    const table = store.tables.get(Number(req.params.id));
    return table ? ok(res, { table }) : fail(res, 404, 'Table not found');
  }));
  router.post('/tables', wrap((req, res) => {
    const { name, url, count, data } = req.body || {};
    if (!name) return fail(res, 400, 'name is required');
    return ok(res, { table: store.tables.create({ name, url, count, data }) });
  }));
  router.delete('/tables/:id', wrap((req, res) => ok(res, { deleted: store.tables.remove(Number(req.params.id)) })));

  // ---- reports ----
  router.get('/reports', wrap((req, res) => ok(res, { reports: store.reports.list() })));
  router.get('/reports/:id', wrap((req, res) => {
    const report = store.reports.get(Number(req.params.id));
    return report ? ok(res, { report }) : fail(res, 404, 'Report not found');
  }));
  router.post('/reports', wrap((req, res) => {
    const { name, report, instructions, businessCount } = req.body || {};
    if (!name || !report) return fail(res, 400, 'name and report are required');
    return ok(res, { report: store.reports.create({ name, report, instructions, businessCount }) });
  }));
  router.delete('/reports/:id', wrap((req, res) => ok(res, { deleted: store.reports.remove(Number(req.params.id)) })));

  // ---- message analyses ----
  router.get('/analyses', wrap((req, res) => ok(res, { analyses: store.analyses.list() })));
  router.get('/analyses/:id', wrap((req, res) => {
    const analysis = store.analyses.get(Number(req.params.id));
    return analysis ? ok(res, { analysis }) : fail(res, 404, 'Analysis not found');
  }));
  router.post('/analyses', wrap((req, res) => {
    const { name, analysis, behaviorInstructions, messagesPreview } = req.body || {};
    if (!name || !analysis) return fail(res, 400, 'name and analysis are required');
    return ok(res, { analysis: store.analyses.create({ name, analysis, behaviorInstructions, messagesPreview }) });
  }));
  router.delete('/analyses/:id', wrap((req, res) => ok(res, { deleted: store.analyses.remove(Number(req.params.id)) })));

  // ---- cost tracking ----
  router.get('/cost-tracking', wrap((req, res) => ok(res, store.cost.get())));
  router.put('/cost-tracking', wrap((req, res) => {
    const { tokens, cost } = req.body || {};
    return ok(res, store.cost.add({ tokens: Number(tokens) || 0, cost: Number(cost) || 0 }));
  }));
  router.post('/cost-tracking/reset', wrap((req, res) => ok(res, store.cost.reset())));

  // ---- presets ----
  router.get('/presets/behavior', wrap((req, res) => ok(res, { presets: store.behaviorPresets.list() })));
  router.post('/presets/behavior', wrap((req, res) => {
    const { name, behavior, files } = req.body || {};
    if (!name || !behavior) return fail(res, 400, 'name and behavior are required');
    return ok(res, { preset: store.behaviorPresets.create({ name, behavior, files }) });
  }));
  router.delete('/presets/behavior/:id', wrap((req, res) => ok(res, { deleted: store.behaviorPresets.remove(Number(req.params.id)) })));

  router.get('/presets/consultant', wrap((req, res) => ok(res, { presets: store.consultantPresets.list() })));
  router.post('/presets/consultant', wrap((req, res) => {
    const { name, behavior } = req.body || {};
    if (!name || !behavior) return fail(res, 400, 'name and behavior are required');
    return ok(res, { preset: store.consultantPresets.create({ name, behavior }) });
  }));
  router.delete('/presets/consultant/:id', wrap((req, res) => ok(res, { deleted: store.consultantPresets.remove(Number(req.params.id)) })));

  // ---- consultant chats ----
  router.get('/chats', wrap((req, res) => ok(res, { chats: store.chats.list() })));
  router.get('/chats/:id', wrap((req, res) => {
    const chat = store.chats.get(Number(req.params.id));
    return chat ? ok(res, { chat }) : fail(res, 404, 'Chat not found');
  }));
  router.post('/chats', wrap((req, res) => {
    const { name } = req.body || {};
    if (!name) return fail(res, 400, 'name is required');
    return ok(res, { chat: store.chats.create(req.body) });
  }));
  router.delete('/chats/:id', wrap((req, res) => ok(res, { deleted: store.chats.remove(Number(req.params.id)) })));

  // ---- clipboard ----
  router.get('/clipboard', wrap((req, res) => ok(res, { messages: store.clipboard.list() })));
  router.post('/clipboard', wrap((req, res) => {
    const { content } = req.body || {};
    if (!content) return fail(res, 400, 'content is required');
    return ok(res, { message: store.clipboard.create({ content }) });
  }));
  router.delete('/clipboard/:id', wrap((req, res) => ok(res, { deleted: store.clipboard.remove(Number(req.params.id)) })));

  // ---- one-shot import of legacy localStorage data ----
  router.post('/import', wrap((req, res) => {
    const blob = req.body || {};
    const counts = {};
    const importList = (items, create) => {
      if (!Array.isArray(items)) return 0;
      let n = 0;
      for (const item of items) { try { create(item); n++; } catch { /* skip bad rows */ } }
      return n;
    };
    counts.tables = importList(blob.savedTables, (t) => store.tables.create({ name: t.name, url: t.url, count: t.count, data: t.data }));
    counts.reports = importList(blob.savedReports, (r) => store.reports.create({ name: r.name, report: r.report, instructions: r.instructions, businessCount: r.businessCount }));
    counts.analyses = importList(blob.savedAnalyses, (a) => store.analyses.create({ name: a.name, analysis: a.analysis, behaviorInstructions: a.behaviorInstructions, messagesPreview: a.messagesPreview }));
    counts.chats = importList(blob.consultantSavedChats, (c) => store.chats.create(c));
    counts.clipboard = importList(blob.clipboardMessages, (c) => store.clipboard.create({ content: c.content }));
    counts.behaviorPresets = importList(blob.behaviorPresets, (p) => store.behaviorPresets.create({ name: p.name, behavior: p.behavior, files: p.files }));
    counts.consultantPresets = importList(blob.consultantPresets, (p) => store.consultantPresets.create({ name: p.name, behavior: p.behavior }));
    return ok(res, { imported: counts });
  }));

  // ---- UI-configurable settings (key/value) ----
  router.get('/settings', wrap((req, res) => ok(res, { settings: store.settings.getAll() })));
  router.post('/settings', wrap((req, res) => ok(res, { settings: store.settings.setMany(req.body || {}) })));

  return router;
}

module.exports = { createDataRoutes };
