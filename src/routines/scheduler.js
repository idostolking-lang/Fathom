// Cron scheduler for routines. Ticks once a minute, runs any enabled schedule
// whose cron matches the current minute, and records last/next run times.
// Missed runs (server was off) are recomputed forward rather than back-filled,
// to avoid an accidental burst of outreach on restart.
const store = require('../../lib/store');
const { cronMatches, nextRun } = require('./cron');

class Scheduler {
  constructor(engine) {
    this.engine = engine;
    this.timer = null;
    this.lastMinute = null;
  }

  start() {
    // Refresh next_run_at for every enabled schedule on boot.
    for (const sched of store.schedules.listEnabled()) {
      try {
        const next = nextRun(sched.cron, new Date());
        store.schedules.setNextRun(sched.id, next ? next.toISOString() : null);
      } catch { /* skip malformed cron */ }
    }
    this.timer = setInterval(() => this.tick(), 30 * 1000);
    this.tick();
    return this;
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  tick(now = new Date()) {
    // Guard against double-firing within the same clock minute.
    const minuteKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
    if (minuteKey === this.lastMinute) return;
    this.lastMinute = minuteKey;

    for (const sched of store.schedules.listEnabled()) {
      let due = false;
      try { due = cronMatches(sched.cron, now); } catch { due = false; }
      if (!due) continue;

      const routine = store.routines.get(sched.routine_id);
      if (!routine || !routine.enabled) continue;

      this.engine.start(routine, { trigger: 'schedule' });
      let next = null;
      try { next = nextRun(sched.cron, now); } catch { /* ignore */ }
      store.schedules.markRun(sched.id, {
        lastRunAt: now.toISOString(),
        nextRunAt: next ? next.toISOString() : null
      });
    }
  }
}

module.exports = { Scheduler };
