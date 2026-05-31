// SQLite persistence for Fathom.
// Single local user, so no auth/ownership columns. Dynamic shapes (business
// rows, chat history, routine steps) are stored as JSON text columns rather
// than over-normalized tables: the data is small, local, and read whole.

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

let db = null;

function resolveDbPath() {
  if (process.env.SQLITE_PATH) return process.env.SQLITE_PATH;
  const dir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'fathom.db');
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS saved_tables (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  url        TEXT,
  count      INTEGER NOT NULL DEFAULT 0,
  data       TEXT    NOT NULL DEFAULT '[]',
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reports (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT    NOT NULL,
  report         TEXT    NOT NULL,
  instructions   TEXT,
  business_count INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS analyses (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  name                  TEXT    NOT NULL,
  analysis              TEXT    NOT NULL,
  behavior_instructions TEXT,
  messages_preview      TEXT,
  created_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cost_tracking (
  id           INTEGER PRIMARY KEY CHECK (id = 1),
  total_tokens INTEGER NOT NULL DEFAULT 0,
  total_cost   REAL    NOT NULL DEFAULT 0,
  entries      TEXT    NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS behavior_presets (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  behavior   TEXT    NOT NULL,
  files      TEXT    NOT NULL DEFAULT '[]',
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS consultant_presets (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  behavior   TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS consultant_chats (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  name                  TEXT    NOT NULL,
  model                 TEXT,
  behavior_instructions TEXT,
  conversation_history  TEXT    NOT NULL DEFAULT '[]',
  message_count         INTEGER NOT NULL DEFAULT 0,
  total_tokens          INTEGER NOT NULL DEFAULT 0,
  created_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clipboard_messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  content    TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS routines (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  description TEXT,
  steps       TEXT    NOT NULL DEFAULT '[]',
  enabled     INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS routine_runs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  routine_id INTEGER REFERENCES routines(id) ON DELETE CASCADE,
  task_id    TEXT,
  status     TEXT    NOT NULL DEFAULT 'running',
  trigger_source TEXT NOT NULL DEFAULT 'manual',
  started_at TEXT    NOT NULL DEFAULT (datetime('now')),
  ended_at   TEXT,
  output     TEXT,
  error      TEXT
);

CREATE TABLE IF NOT EXISTS run_logs (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id  INTEGER REFERENCES routine_runs(id) ON DELETE CASCADE,
  type    TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  ts      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS schedules (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  routine_id  INTEGER REFERENCES routines(id) ON DELETE CASCADE,
  cron        TEXT    NOT NULL,
  enabled     INTEGER NOT NULL DEFAULT 1,
  next_run_at TEXT,
  last_run_at TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_runs_routine   ON routine_runs(routine_id);
CREATE INDEX IF NOT EXISTS idx_runlogs_run    ON run_logs(run_id);
CREATE INDEX IF NOT EXISTS idx_schedules_rid  ON schedules(routine_id);
`;

function getDb() {
  if (db) return db;
  db = new Database(resolveDbPath());
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  // cost_tracking is a singleton accumulator row.
  db.prepare('INSERT OR IGNORE INTO cost_tracking (id) VALUES (1)').run();
  return db;
}

module.exports = { getDb, resolveDbPath };
