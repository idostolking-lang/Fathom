// Console shell: timezone-aware clock, rail navigation, and the live Operations dock.
// Loads after the feature modules and authFetch (which adds the access token).
(function () {
  // ---- timezone-aware clock ----
  const TZ_KEY = 'fathomTimezone';
  const ZONES = [
    'auto', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'America/Sao_Paulo', 'Europe/London', 'Europe/Berlin', 'Europe/Paris', 'Asia/Jerusalem',
    'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney'
  ];
  function storedZone() { try { return localStorage.getItem(TZ_KEY) || 'auto'; } catch (e) { return 'auto'; } }
  function effectiveZone() {
    const z = storedZone();
    if (z && z !== 'auto') return z;
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { return undefined; }
  }
  // Show hours:minutes (no seconds) and only touch the DOM when it actually
  // changes, so the readout doesn't visibly tick/refresh every second.
  let lastClock = '';
  function clock() {
    const el = document.getElementById('currentTime');
    if (!el) return;
    let text;
    try {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: effectiveZone(), hour: '2-digit', minute: '2-digit', hour12: false, timeZoneName: 'short'
      }).formatToParts(new Date());
      const get = (t) => (parts.find((p) => p.type === t) || {}).value || '';
      text = `${get('hour')}:${get('minute')} ${get('timeZoneName')}`;
    } catch (e) {
      const d = new Date();
      text = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
    if (text !== lastClock) { el.textContent = text; lastClock = text; }
  }
  clock();
  setInterval(clock, 15000);

  // Click the time readout to choose a timezone (for different countries).
  (function buildTzPicker() {
    const timeEl = document.getElementById('currentTime');
    if (!timeEl) return;
    const readout = typeof timeEl.closest === 'function' ? timeEl.closest('.readout') : null;
    if (!readout) return;
    readout.style.cursor = 'pointer';
    readout.title = 'Click to change timezone';
    const sel = document.createElement('select');
    sel.className = 'form-input';
    sel.style.cssText = 'position:absolute;top:52px;right:16px;width:220px;z-index:60;display:none';
    sel.innerHTML = ZONES.map((z) => `<option value="${z}"${z === storedZone() ? ' selected' : ''}>${z === 'auto' ? 'Auto (this device)' : z.replace('_', ' ')}</option>`).join('');
    document.body.appendChild(sel);
    readout.addEventListener('click', () => { sel.style.display = sel.style.display === 'none' ? 'block' : 'none'; });
    sel.addEventListener('change', () => { try { localStorage.setItem(TZ_KEY, sel.value); } catch (e) {} sel.style.display = 'none'; clock(); });
    document.addEventListener('click', (e) => { if (e.target !== sel && !readout.contains(e.target)) sel.style.display = 'none'; });
  })();

  // ---- rail navigation ----
  const navs = Array.from(document.querySelectorAll('.rail .nav'));
  const screens = Array.from(document.querySelectorAll('.stage .screen'));
  navs.forEach((n) => n.addEventListener('click', () => {
    if (n.dataset.launch) {
      const btn = document.getElementById(n.dataset.launch);
      if (btn) btn.click();
      return;
    }
    const screen = n.dataset.screen;
    if (!screen) return;
    navs.forEach((x) => x.classList.toggle('active', x === n));
    screens.forEach((s) => s.classList.toggle('show', s.id === 'screen-' + screen));
    if (screen === 'routines' && window.Routines) window.Routines.init();
    if (screen === 'docs' && window.Docs) window.Docs.init();
    if (screen === 'settings' && window.Settings) window.Settings.init();
  }));

  // ---- operations dock ----
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function setText(id, v) { const e = document.getElementById(id); if (e) e.textContent = v; }
  function renderJob(t) {
    const pct = Math.max(0, Math.min(100, Math.round(t.progress || 0)));
    const logs = (t.logs || []).slice(-2).map((l) => `<div>${esc(typeof l === 'string' ? l : (l.message || ''))}</div>`).join('');
    const done = t.status === 'completed';
    return `
      <div class="job">
        <div class="jt"><span class="jt-name">${esc(t.name || t.description || t.type || 'job')}</span><span class="status ${done ? 'done' : 'run'}" style="margin-left:auto;flex:none"><span class="dot"></span>${esc(t.status || 'running')}</span></div>
        <div class="jm"><span>${esc(t.type || '')}</span><span>${pct}%</span></div>
        <div class="bar-track"><div class="bar-fill ${done ? 'green' : ''}" style="width:${pct}%"></div></div>
        ${logs ? `<div class="mono" style="font-size:10.5px;color:var(--text-low);margin-top:8px;line-height:1.6;word-break:break-word;overflow-wrap:anywhere">${logs}</div>` : ''}
      </div>`;
  }
  async function pollOps() {
    try {
      const r = await fetch('/api/tasks/active');
      if (!r.ok) return;
      const j = await r.json();
      const tasks = j.tasks || [];
      setText('activeRunsCount', String(tasks.length).padStart(2, '0'));
      setText('dockCount', tasks.length);
      setText('dockQueue', tasks.length ? 'running' : 'idle');
      const body = document.getElementById('dockBody');
      if (body) body.innerHTML = tasks.length ? tasks.map(renderJob).join('') : '<div class="rt-empty">No active jobs</div>';
    } catch (e) { /* offline or unauthorized */ }
  }
  pollOps();
  setInterval(pollOps, 4000);
})();
