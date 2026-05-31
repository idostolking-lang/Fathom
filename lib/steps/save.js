// "Save" step: persist the working set as a saved table. Terminal-ish step;
// passes rows through unchanged so later steps can still act on them.
const store = require('../store');

function save(rows = [], config = {}, ctx = {}) {
  const stamp = new Date().toISOString().slice(0, 10);
  const name = config.name || `Routine results ${stamp}`;
  const table = store.tables.create({ name, url: config.url || null, count: rows.length, data: rows });
  (ctx.log || (() => {}))(`Saved ${rows.length} rows to table "${name}"`, 'success');
  (ctx.onProgress || (() => {}))(100, `Saved as "${name}"`);
  return { rows, savedTableId: table.id, savedTableName: name };
}

module.exports = { save };
