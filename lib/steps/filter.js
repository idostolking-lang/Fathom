// "Filter" step: narrow the working set by a predicate. Pure, no I/O.
// config: { field, op, value }  e.g. { field: 'Website', op: 'not_empty' }
const { getField } = require('./_shared');

function filter(rows = [], config = {}, ctx = {}) {
  const { field = 'Website', op = 'not_empty', value = '' } = config;
  const needle = String(value).toLowerCase();

  const keep = (row) => {
    const raw = String(getField(row, field) ?? '').trim().toLowerCase();
    switch (op) {
      case 'not_empty': return raw !== '' && raw !== 'n/a';
      case 'empty': return raw === '' || raw === 'n/a';
      case 'contains': return raw.includes(needle);
      case 'not_contains': return !raw.includes(needle);
      case 'equals': return raw === needle;
      default: return true;
    }
  };

  const out = rows.filter(keep);
  (ctx.log || (() => {}))(`Filter ${field} ${op} ${value || ''}: kept ${out.length} of ${rows.length}`, 'info');
  (ctx.onProgress || (() => {}))(100, `Kept ${out.length} of ${rows.length}`);
  return out;
}

module.exports = { filter };
