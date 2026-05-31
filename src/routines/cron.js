// Tiny standard 5-field cron parser: "minute hour day-of-month month day-of-week".
// Supports *, lists (1,2), ranges (1-5), and steps (*/n, 1-9/2). Day-of-month
// and day-of-week combine with OR when both are restricted, matching cron.

function parseField(expr, min, max) {
  const allowed = new Set();
  for (const part of String(expr).split(',')) {
    const [range, stepRaw] = part.split('/');
    const step = stepRaw ? parseInt(stepRaw, 10) : 1;
    let lo = min;
    let hi = max;
    if (range !== '*' && range !== '') {
      const [a, b] = range.split('-');
      lo = parseInt(a, 10);
      hi = b !== undefined ? parseInt(b, 10) : lo;
    }
    if (Number.isNaN(lo) || Number.isNaN(hi) || Number.isNaN(step) || step < 1) continue;
    for (let v = lo; v <= hi; v += step) {
      if (v >= min && v <= max) allowed.add(v);
    }
  }
  return allowed;
}

function parseCron(expr) {
  const fields = String(expr).trim().split(/\s+/);
  if (fields.length !== 5) throw new Error(`Invalid cron "${expr}" (need 5 fields)`);
  const [m, h, dom, mon, dow] = fields;
  return {
    minute: parseField(m, 0, 59),
    hour: parseField(h, 0, 23),
    dom: parseField(dom, 1, 31),
    month: parseField(mon, 1, 12),
    dow: parseField(dow, 0, 6),
    domRestricted: dom.trim() !== '*',
    dowRestricted: dow.trim() !== '*'
  };
}

function matches(parsed, date) {
  const minuteOk = parsed.minute.has(date.getMinutes());
  const hourOk = parsed.hour.has(date.getHours());
  const monthOk = parsed.month.has(date.getMonth() + 1);
  const domHit = parsed.dom.has(date.getDate());
  const dowHit = parsed.dow.has(date.getDay());
  // Standard cron: if both day fields are restricted, either may match.
  const dayOk = parsed.domRestricted && parsed.dowRestricted
    ? (domHit || dowHit)
    : (domHit && dowHit);
  return minuteOk && hourOk && monthOk && dayOk;
}

function cronMatches(expr, date) {
  return matches(parseCron(expr), date);
}

// Next firing strictly after `from`, scanning minute by minute (bounded ~1yr).
function nextRun(expr, from = new Date()) {
  const parsed = parseCron(expr);
  const cursor = new Date(from.getTime());
  cursor.setSeconds(0, 0);
  cursor.setMinutes(cursor.getMinutes() + 1);
  for (let i = 0; i < 366 * 24 * 60; i++) {
    if (matches(parsed, cursor)) return new Date(cursor.getTime());
    cursor.setMinutes(cursor.getMinutes() + 1);
  }
  return null;
}

module.exports = { parseCron, cronMatches, nextRun };
