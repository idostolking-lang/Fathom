// Typed data-access layer over the SQLite database.
// Routes call these functions; no SQL leaks into the HTTP layer.
// JSON columns are parsed on read and serialized on write here.

const { getDb } = require('./db');

const parse = (value, fallback) => {
  if (value == null) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
};

// Expose created_at under `date` too, since the existing frontend reads `date`.
const withDate = (row) => (row ? { ...row, date: row.created_at } : row);

// ---------- saved tables ----------
const tables = {
  list() {
    return getDb()
      .prepare('SELECT id, name, url, count, created_at FROM saved_tables ORDER BY id DESC')
      .all()
      .map(withDate);
  },
  get(id) {
    const row = getDb().prepare('SELECT * FROM saved_tables WHERE id = ?').get(id);
    if (!row) return null;
    return withDate({ ...row, data: parse(row.data, []) });
  },
  create({ name, url = null, count = null, data = [] }) {
    const rows = Array.isArray(data) ? data : [];
    const info = getDb()
      .prepare('INSERT INTO saved_tables (name, url, count, data) VALUES (?, ?, ?, ?)')
      .run(name, url, count == null ? rows.length : count, JSON.stringify(rows));
    return tables.get(info.lastInsertRowid);
  },
  remove(id) {
    return getDb().prepare('DELETE FROM saved_tables WHERE id = ?').run(id).changes > 0;
  }
};

// ---------- reports ----------
const reports = {
  list() {
    return getDb()
      .prepare('SELECT id, name, instructions, business_count, created_at FROM reports ORDER BY id DESC')
      .all()
      .map(withDate);
  },
  get(id) {
    return withDate(getDb().prepare('SELECT * FROM reports WHERE id = ?').get(id) || null);
  },
  create({ name, report, instructions = null, businessCount = 0 }) {
    const info = getDb()
      .prepare('INSERT INTO reports (name, report, instructions, business_count) VALUES (?, ?, ?, ?)')
      .run(name, report, instructions, businessCount);
    return reports.get(info.lastInsertRowid);
  },
  remove(id) {
    return getDb().prepare('DELETE FROM reports WHERE id = ?').run(id).changes > 0;
  }
};

// ---------- message analyses ----------
const analyses = {
  list() {
    return getDb()
      .prepare('SELECT id, name, behavior_instructions, messages_preview, created_at FROM analyses ORDER BY id DESC')
      .all()
      .map(withDate);
  },
  get(id) {
    return withDate(getDb().prepare('SELECT * FROM analyses WHERE id = ?').get(id) || null);
  },
  create({ name, analysis, behaviorInstructions = null, messagesPreview = null }) {
    const info = getDb()
      .prepare('INSERT INTO analyses (name, analysis, behavior_instructions, messages_preview) VALUES (?, ?, ?, ?)')
      .run(name, analysis, behaviorInstructions, messagesPreview);
    return analyses.get(info.lastInsertRowid);
  },
  remove(id) {
    return getDb().prepare('DELETE FROM analyses WHERE id = ?').run(id).changes > 0;
  }
};

// ---------- cost tracking (singleton) ----------
const cost = {
  get() {
    const row = getDb().prepare('SELECT * FROM cost_tracking WHERE id = 1').get();
    return { totalTokens: row.total_tokens, totalCost: row.total_cost, entries: parse(row.entries, []) };
  },
  add({ tokens = 0, cost: spend = 0 }) {
    const current = cost.get();
    const entries = [...current.entries, { tokens, cost: spend, date: new Date().toISOString() }];
    getDb()
      .prepare('UPDATE cost_tracking SET total_tokens = ?, total_cost = ?, entries = ? WHERE id = 1')
      .run(current.totalTokens + tokens, current.totalCost + spend, JSON.stringify(entries));
    return cost.get();
  },
  reset() {
    getDb().prepare("UPDATE cost_tracking SET total_tokens = 0, total_cost = 0, entries = '[]' WHERE id = 1").run();
    return cost.get();
  }
};

// ---------- presets ----------
const behaviorPresets = {
  list() {
    return getDb().prepare('SELECT * FROM behavior_presets ORDER BY id DESC').all()
      .map((r) => withDate({ ...r, files: parse(r.files, []) }));
  },
  create({ name, behavior, files = [] }) {
    const info = getDb()
      .prepare('INSERT INTO behavior_presets (name, behavior, files) VALUES (?, ?, ?)')
      .run(name, behavior, JSON.stringify(Array.isArray(files) ? files : []));
    const row = getDb().prepare('SELECT * FROM behavior_presets WHERE id = ?').get(info.lastInsertRowid);
    return withDate({ ...row, files: parse(row.files, []) });
  },
  remove(id) {
    return getDb().prepare('DELETE FROM behavior_presets WHERE id = ?').run(id).changes > 0;
  }
};

const consultantPresets = {
  list() {
    return getDb().prepare('SELECT * FROM consultant_presets ORDER BY id DESC').all().map(withDate);
  },
  create({ name, behavior }) {
    const info = getDb()
      .prepare('INSERT INTO consultant_presets (name, behavior) VALUES (?, ?)')
      .run(name, behavior);
    return withDate(getDb().prepare('SELECT * FROM consultant_presets WHERE id = ?').get(info.lastInsertRowid));
  },
  remove(id) {
    return getDb().prepare('DELETE FROM consultant_presets WHERE id = ?').run(id).changes > 0;
  }
};

// ---------- consultant chats ----------
const chats = {
  list() {
    return getDb()
      .prepare('SELECT id, name, model, message_count, total_tokens, created_at FROM consultant_chats ORDER BY id DESC')
      .all()
      .map(withDate);
  },
  get(id) {
    const row = getDb().prepare('SELECT * FROM consultant_chats WHERE id = ?').get(id);
    if (!row) return null;
    return withDate({ ...row, conversationHistory: parse(row.conversation_history, []) });
  },
  create({ name, model = null, behaviorInstructions = null, conversationHistory = [], messageCount = 0, totalTokens = 0 }) {
    const history = Array.isArray(conversationHistory) ? conversationHistory : [];
    const info = getDb()
      .prepare(`INSERT INTO consultant_chats
        (name, model, behavior_instructions, conversation_history, message_count, total_tokens)
        VALUES (?, ?, ?, ?, ?, ?)`)
      .run(name, model, behaviorInstructions, JSON.stringify(history), messageCount || history.length, totalTokens);
    return chats.get(info.lastInsertRowid);
  },
  remove(id) {
    return getDb().prepare('DELETE FROM consultant_chats WHERE id = ?').run(id).changes > 0;
  }
};

// ---------- clipboard ----------
const clipboard = {
  list() {
    return getDb().prepare('SELECT * FROM clipboard_messages ORDER BY id DESC').all().map(withDate);
  },
  create({ content }) {
    const info = getDb().prepare('INSERT INTO clipboard_messages (content) VALUES (?)').run(content);
    return withDate(getDb().prepare('SELECT * FROM clipboard_messages WHERE id = ?').get(info.lastInsertRowid));
  },
  remove(id) {
    return getDb().prepare('DELETE FROM clipboard_messages WHERE id = ?').run(id).changes > 0;
  }
};

// ---------- routines ----------
const routines = {
  list() {
    return getDb().prepare('SELECT * FROM routines ORDER BY updated_at DESC').all()
      .map((r) => ({ ...r, enabled: !!r.enabled, steps: parse(r.steps, []) }));
  },
  get(id) {
    const row = getDb().prepare('SELECT * FROM routines WHERE id = ?').get(id);
    if (!row) return null;
    return { ...row, enabled: !!row.enabled, steps: parse(row.steps, []) };
  },
  create({ name, description = null, steps = [], enabled = true }) {
    const info = getDb()
      .prepare('INSERT INTO routines (name, description, steps, enabled) VALUES (?, ?, ?, ?)')
      .run(name, description, JSON.stringify(Array.isArray(steps) ? steps : []), enabled ? 1 : 0);
    return routines.get(info.lastInsertRowid);
  },
  update(id, { name, description, steps, enabled }) {
    const current = routines.get(id);
    if (!current) return null;
    getDb().prepare(`UPDATE routines SET name = ?, description = ?, steps = ?, enabled = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(
        name ?? current.name,
        description ?? current.description,
        JSON.stringify(steps ?? current.steps),
        (enabled ?? current.enabled) ? 1 : 0,
        id
      );
    return routines.get(id);
  },
  remove(id) {
    return getDb().prepare('DELETE FROM routines WHERE id = ?').run(id).changes > 0;
  }
};

// ---------- routine runs + logs ----------
const runs = {
  create({ routineId, taskId = null, trigger = 'manual' }) {
    const info = getDb()
      .prepare('INSERT INTO routine_runs (routine_id, task_id, trigger_source) VALUES (?, ?, ?)')
      .run(routineId, taskId, trigger);
    return runs.get(info.lastInsertRowid);
  },
  get(id) {
    const row = getDb().prepare('SELECT * FROM routine_runs WHERE id = ?').get(id);
    if (!row) return null;
    return { ...row, output: parse(row.output, null) };
  },
  finish(id, { status, output = null, error = null }) {
    getDb()
      .prepare(`UPDATE routine_runs SET status = ?, output = ?, error = ?, ended_at = datetime('now') WHERE id = ?`)
      .run(status, output == null ? null : JSON.stringify(output), error, id);
    return runs.get(id);
  },
  listForRoutine(routineId, limit = 25) {
    return getDb()
      .prepare('SELECT * FROM routine_runs WHERE routine_id = ? ORDER BY id DESC LIMIT ?')
      .all(routineId, limit)
      .map((r) => ({ ...r, output: parse(r.output, null) }));
  },
  log(runId, message, type = 'info') {
    getDb().prepare('INSERT INTO run_logs (run_id, type, message) VALUES (?, ?, ?)').run(runId, type, message);
  },
  logs(runId) {
    return getDb().prepare('SELECT type, message, ts FROM run_logs WHERE run_id = ? ORDER BY id ASC').all(runId);
  }
};

// ---------- schedules ----------
const schedules = {
  list() {
    return getDb().prepare('SELECT * FROM schedules ORDER BY id DESC').all()
      .map((r) => ({ ...r, enabled: !!r.enabled }));
  },
  listEnabled() {
    return getDb().prepare('SELECT * FROM schedules WHERE enabled = 1').all()
      .map((r) => ({ ...r, enabled: true }));
  },
  forRoutine(routineId) {
    return getDb().prepare('SELECT * FROM schedules WHERE routine_id = ?').all(routineId)
      .map((r) => ({ ...r, enabled: !!r.enabled }));
  },
  create({ routineId, cron, enabled = true, nextRunAt = null }) {
    const info = getDb()
      .prepare('INSERT INTO schedules (routine_id, cron, enabled, next_run_at) VALUES (?, ?, ?, ?)')
      .run(routineId, cron, enabled ? 1 : 0, nextRunAt);
    return getDb().prepare('SELECT * FROM schedules WHERE id = ?').get(info.lastInsertRowid);
  },
  markRun(id, { lastRunAt, nextRunAt }) {
    getDb().prepare('UPDATE schedules SET last_run_at = ?, next_run_at = ? WHERE id = ?').run(lastRunAt, nextRunAt, id);
  },
  setNextRun(id, nextRunAt) {
    getDb().prepare('UPDATE schedules SET next_run_at = ? WHERE id = ?').run(nextRunAt, id);
  },
  remove(id) {
    return getDb().prepare('DELETE FROM schedules WHERE id = ?').run(id).changes > 0;
  }
};

// ---------- settings (key/value, UI-configurable) ----------
const settings = {
  getAll() {
    const rows = getDb().prepare('SELECT key, value FROM settings').all();
    const out = {};
    for (const r of rows) out[r.key] = r.value;
    return out;
  },
  get(key, fallback = null) {
    const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : fallback;
  },
  set(key, value) {
    getDb().prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, value == null ? null : String(value));
  },
  setMany(obj) {
    for (const k of Object.keys(obj || {})) settings.set(k, obj[k]);
    return settings.getAll();
  }
};

module.exports = {
  tables, reports, analyses, cost,
  behaviorPresets, consultantPresets, chats, clipboard,
  routines, runs, schedules, settings
};
