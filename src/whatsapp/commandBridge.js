// WhatsApp command bridge: parse a text from the authorized phone number into an
// action on routines and return a reply string. Only reached for the authorized
// number (the listener in whatsappRoutes gates that), so this layer just routes.
const store = require('../../lib/store');
const taskManager = require('../tasks/taskManager');
const { nextRun } = require('../routines/cron');

function findRoutine(arg) {
  if (!arg) return null;
  const byId = store.routines.get(Number(arg));
  if (byId) return byId;
  const all = store.routines.list();
  const lower = String(arg).toLowerCase();
  return all.find((r) => r.name.toLowerCase() === lower) || all.find((r) => r.name.toLowerCase().includes(lower)) || null;
}

function createCommandBridge({ engine }) {
  function handle(text) {
    const t = String(text || '').trim();
    if (!t) return null;
    const parts = t.split(/\s+/);
    const c = parts[0].toLowerCase();
    const arg = parts.slice(1).join(' ').trim();
    try {
      switch (c) {
        case 'help': case '?': case 'commands': return help();
        case 'routines': case 'list': case 'ls': return list();
        case 'status': case 'jobs': return status();
        case 'run': case 'start': return run(arg);
        case 'runs': case 'history': return history(arg);
        case 'schedule': return schedule(parts.slice(1));
        case 'enable': return toggle(arg, true);
        case 'disable': return toggle(arg, false);
        case 'new': case 'create': return create(arg);
        default: return `Unknown command "${parts[0]}". Send "help" for the list.`;
      }
    } catch (err) {
      return 'Error: ' + err.message;
    }
  }

  function help() {
    return [
      'Fathom commands:',
      'list  -  your routines',
      'run <id|name>  -  run a routine now',
      'status  -  active jobs',
      'runs <id|name>  -  recent runs',
      'schedule <id> <min hour dom mon dow>  -  cron schedule',
      'enable / disable <id|name>',
      'new <name>  -  create an empty routine',
      'help  -  this list'
    ].join('\n');
  }

  function list() {
    const rs = store.routines.list();
    if (!rs.length) return 'No routines yet. Make one in the app, or send "new <name>".';
    return 'Routines:\n' + rs.map((r) => `${r.id}. ${r.name} (${(r.steps || []).length} steps${r.enabled ? '' : ', disabled'})`).join('\n');
  }

  function status() {
    const active = taskManager.getActiveTasks ? taskManager.getActiveTasks() : [];
    if (!active.length) return 'No active jobs.';
    return 'Active jobs:\n' + active.map((x) => `- ${x.description || x.type} (${x.progress || 0}%)`).join('\n');
  }

  function run(arg) {
    const r = findRoutine(arg);
    if (!r) return `Routine "${arg}" not found. Send "list".`;
    if (!(r.steps || []).length) return `"${r.name}" has no steps yet. Add some in the app first.`;
    engine.start(r, { trigger: 'whatsapp' });
    return `Started "${r.name}". I will message you when it finishes.`;
  }

  function history(arg) {
    const r = findRoutine(arg);
    if (!r) return `Routine "${arg}" not found.`;
    const runs = store.runs.listForRoutine(r.id, 5);
    if (!runs.length) return `No runs yet for "${r.name}".`;
    return `Recent runs of "${r.name}":\n` + runs.map((x) => `- ${x.status}${x.output && x.output.rows != null ? ' (' + x.output.rows + ' rows)' : ''}`).join('\n');
  }

  function schedule(rest) {
    const r = findRoutine(rest[0]);
    if (!r) return `Routine "${rest[0] || ''}" not found.`;
    const cron = rest.slice(1).join(' ').trim();
    if (!cron) return 'Add a cron: schedule <id> <min hour dom mon dow>. Example: schedule 1 0 7 * * *';
    let next;
    try { next = nextRun(cron, new Date()); } catch (e) { return 'Invalid cron: ' + e.message; }
    store.schedules.create({ routineId: r.id, cron, nextRunAt: next ? next.toISOString() : null });
    return `Scheduled "${r.name}" (${cron}).`;
  }

  function toggle(arg, enabled) {
    const r = findRoutine(arg);
    if (!r) return `Routine "${arg}" not found.`;
    store.routines.update(r.id, { enabled });
    return `"${r.name}" ${enabled ? 'enabled' : 'disabled'}.`;
  }

  function create(name) {
    if (!name) return 'Add a name: new <name>.';
    const r = store.routines.create({ name, steps: [] });
    return `Created "${r.name}" (id ${r.id}). Add steps in the app, then "run ${r.id}".`;
  }

  return { handle };
}

module.exports = { createCommandBridge };
