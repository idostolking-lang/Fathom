// Routines builder: compose a pipeline of steps, save it, run it, schedule it.
// Talks to the SQLite-backed /api/routines endpoints. Mounts into #routinesRoot.
(function () {
  const STEP_TYPES = {
    discover: { label: 'Discover', glyph: '01', desc: 'Scrape Google Maps', fields: [
      { k: 'url', label: 'Google Maps URL', type: 'text', ph: 'https://www.google.com/maps/search/dentists+in+berlin' },
      { k: 'duration', label: 'Max minutes', type: 'number', def: 10 }
    ] },
    filter: { label: 'Filter', glyph: '02', desc: 'Keep matching rows', fields: [
      { k: 'field', label: 'Field', type: 'select', opts: ['Website', 'Email', 'Phone', 'Name', 'Address'], def: 'Website' },
      { k: 'op', label: 'Condition', type: 'select', opts: ['not_empty', 'empty', 'contains', 'not_contains', 'equals'], def: 'not_empty' },
      { k: 'value', label: 'Value (for contains / equals)', type: 'text', ph: '' }
    ] },
    enrich: { label: 'Enrich', glyph: '03', desc: 'Extract contact emails from sites', fields: [] },
    analyze: { label: 'Analyze', glyph: '04', desc: 'Draft outreach with AI', fields: [
      { k: 'instructions', label: 'AI instructions', type: 'textarea', ph: 'Write a short, friendly outreach opener.' },
      { k: 'model', label: 'Model', type: 'model', def: 'gpt-4o' }
    ] },
    send_email: { label: 'Send email', glyph: '05', desc: 'Email each row', fields: [
      { k: 'subject', label: 'Subject', type: 'text', ph: 'A quick idea for {{Name}}' },
      { k: 'message', label: 'Body (blank uses the AI draft)', type: 'textarea', ph: 'Hi {{Name}},' },
      { k: 'throttleMs', label: 'Delay between sends (ms)', type: 'number', def: 2000 }
    ] },
    send_whatsapp: { label: 'Send WhatsApp', glyph: '05', desc: 'Message each phone', fields: [
      { k: 'message', label: 'Message', type: 'textarea', ph: 'Hi {{Name}},' },
      { k: 'throttleMs', label: 'Delay between sends (ms)', type: 'number', def: 3000 }
    ] },
    send_sms: { label: 'Send SMS', glyph: '05', desc: 'Text each phone', fields: [
      { k: 'message', label: 'Message', type: 'textarea', ph: 'Hi {{Name}},' },
      { k: 'throttleMs', label: 'Delay between sends (ms)', type: 'number', def: 1500 }
    ] },
    save: { label: 'Save', glyph: '06', desc: 'Save the set as a table', fields: [
      { k: 'name', label: 'Table name', type: 'text', ph: 'My results' }
    ] }
  };

  let routines = [];
  let current = null;
  let inited = false;
  let root;

  function init() {
    root = document.getElementById('routinesRoot');
    if (!root) return;
    if (!inited) { scaffold(); inited = true; }
    load();
  }

  function scaffold() {
    root.innerHTML = `
      <div class="head">
        <div>
          <div class="crumb">Automate <span class="sep">/</span> Routines</div>
          <h1>Routines</h1>
          <p>Compose a pipeline once, run it on demand or on a schedule. Each step passes its working set to the next.</p>
        </div>
        <button class="btn signal" data-action="new">+ New routine</button>
      </div>
      <div class="rt-wrap">
        <div class="panel rt-list">
          <div class="ph"><h3>Saved</h3><span class="meta" id="rtCount">0</span></div>
          <div id="rtListBody"></div>
        </div>
        <div class="panel rt-build" id="rtBuild"></div>
      </div>`;
    root.addEventListener('click', onClick);
    root.addEventListener('input', onField);
    root.addEventListener('change', onField);
  }

  async function load() {
    try { const r = await fetch('/api/routines'); const j = await r.json(); routines = j.routines || []; }
    catch (e) { routines = []; }
    renderList();
    if (current && current.id) { const found = routines.find((r) => r.id === current.id); if (found) { renderBuild(); return; } }
    if (routines.length) selectRoutine(routines[0].id);
    else newRoutine();
  }

  function renderList() {
    setText('rtCount', routines.length);
    const body = root.querySelector('#rtListBody');
    body.innerHTML = routines.length ? routines.map((r) => `
      <div class="rt-item ${current && current.id === r.id ? 'active' : ''}" data-action="select" data-id="${r.id}">
        <div class="t">${esc(r.name)}</div>
        <div class="m"><span>${(r.steps || []).length} steps</span><span>${r.enabled ? 'enabled' : 'disabled'}</span></div>
      </div>`).join('') : '<div class="rt-empty">No routines yet</div>';
  }

  function newRoutine() {
    current = { name: 'New routine', description: '', steps: [], enabled: true };
    renderList(); renderBuild();
  }

  async function selectRoutine(id) {
    try { const r = await fetch('/api/routines/' + id); const j = await r.json(); current = j.routine; }
    catch (e) { return; }
    renderList(); renderBuild();
  }

  function renderBuild() {
    const b = root.querySelector('#rtBuild');
    if (!current) { b.innerHTML = '<div class="rt-empty">Select or create a routine</div>'; return; }
    b.innerHTML = `
      <div class="form-group"><label>Routine name</label><input class="form-input" data-field="name" value="${escAttr(current.name)}"></div>
      <div class="rt-summary" id="rtSummary">${summaryHTML()}</div>
      <div class="rt-pipe">${current.steps.map((s, i) => stepHTML(s, i)).join('')}</div>
      <div class="rt-add" data-action="toggleAdd">+ Add step</div>
      <div class="chips" id="rtAddMenu" style="display:none;margin-top:10px">
        ${Object.keys(STEP_TYPES).map((t) => `<span class="chip" data-action="add" data-type="${t}">${STEP_TYPES[t].label}</span>`).join('')}
      </div>
      <div class="rt-runbar">
        <button class="btn signal" data-action="save">Save</button>
        <button class="btn" data-action="run">Run now</button>
        <button class="btn ghost" data-action="schedule">Schedule</button>
        ${current.id ? '<button class="btn ghost" data-action="delete">Delete</button>' : ''}
        <span class="muted mono" style="font-size:11px;margin-left:auto" id="rtStatus"></span>
      </div>
      <div id="rtSchedule"></div>`;
  }

  function stepHTML(s, i) {
    const T = STEP_TYPES[s.type] || { label: s.type, glyph: '?', desc: '', fields: [] };
    const cfg = s.config || {};
    const tpl = s.type === 'analyze' && window.FATHOM
      ? `<select class="form-input" data-tpl="outreach" data-i="${i}" data-target="instructions">${window.FATHOM.templateOptions('outreach')}</select>`
      : '';
    const fields = tpl + T.fields.map((f) => fieldHTML(f, cfg[f.k], i)).join('');
    return `
      <div class="rt-step">
        <div class="rt-gutter"><div class="rt-glyph">${T.glyph}</div><div class="rt-line"></div></div>
        <div class="rt-card">
          <div class="rt-top">
            <div><div class="rt-kind">${String(i + 1).padStart(2, '0')} &middot; ${T.label}</div><h4>${esc(T.desc)}</h4></div>
            <div class="rt-actions">
              <button class="btn ghost sm" data-action="up" data-i="${i}" title="Move up">&uarr;</button>
              <button class="btn ghost sm" data-action="down" data-i="${i}" title="Move down">&darr;</button>
              <button class="btn danger sm" data-action="remove" data-i="${i}" title="Remove">&times;</button>
            </div>
          </div>
          ${fields ? `<div class="rt-cfg">${fields}</div>` : ''}
        </div>
      </div>`;
  }

  function fieldHTML(f, val, i) {
    val = val == null ? (f.def != null ? f.def : '') : val;
    const attrs = `data-cfg data-i="${i}" data-k="${f.k}"`;
    if (f.type === 'textarea') return `<textarea class="form-input" ${attrs} placeholder="${escAttr(f.ph || '')}">${esc(val)}</textarea>`;
    if (f.type === 'model') return `<select class="form-input" ${attrs}>${window.FATHOM ? window.FATHOM.modelOptions(val) : `<option>${esc(val)}</option>`}</select>`;
    if (f.type === 'select') return `<select class="form-input" ${attrs}>${f.opts.map((o) => `<option ${o === val ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
    return `<input class="form-input" type="${f.type === 'number' ? 'number' : 'text'}" ${attrs} value="${escAttr(val)}" placeholder="${escAttr(f.ph || '')}">`;
  }

  function summaryHTML() {
    if (!current.steps.length) return 'Add steps to build the pipeline.';
    const phrase = (s) => {
      const c = s.config || {};
      switch (s.type) {
        case 'discover': return `<b>discover</b> ${c.url ? 'a market' : '(set a URL)'}`;
        case 'filter': return `<b>keep</b> rows where ${esc(c.field || 'Website')} is ${esc((c.op || 'not_empty').replace('_', ' '))}${c.value ? ' ' + esc(c.value) : ''}`;
        case 'enrich': return '<b>pull</b> contact emails';
        case 'analyze': return '<b>draft</b> messages with AI';
        case 'send_email': return '<b>send</b> email';
        case 'send_whatsapp': return '<b>message</b> on WhatsApp';
        case 'save': return `<b>save</b> as "${esc(c.name || 'a table')}"`;
        default: return esc(s.type);
      }
    };
    return 'This routine will ' + current.steps.map(phrase).join(', then ') + '.';
  }

  function onClick(e) {
    const t = e.target.closest('[data-action]');
    if (!t) return;
    const a = t.dataset.action;
    const i = t.dataset.i != null ? Number(t.dataset.i) : null;
    if (a === 'new') return newRoutine();
    if (a === 'select') return selectRoutine(Number(t.dataset.id));
    if (a === 'toggleAdd') { const m = root.querySelector('#rtAddMenu'); m.style.display = m.style.display === 'none' ? 'flex' : 'none'; return; }
    if (a === 'add') { current.steps.push({ type: t.dataset.type, config: defaults(t.dataset.type) }); renderBuild(); return; }
    if (a === 'up' && i > 0) { [current.steps[i - 1], current.steps[i]] = [current.steps[i], current.steps[i - 1]]; renderBuild(); return; }
    if (a === 'down' && i < current.steps.length - 1) { [current.steps[i + 1], current.steps[i]] = [current.steps[i], current.steps[i + 1]]; renderBuild(); return; }
    if (a === 'remove') { current.steps.splice(i, 1); renderBuild(); return; }
    if (a === 'save') return save();
    if (a === 'run') return run();
    if (a === 'schedule') return showSchedule();
    if (a === 'setSchedule') return setSchedule(t.dataset.cron || root.querySelector('#rtCronSel').value);
    if (a === 'delete') return remove();
  }

  function onField(e) {
    const t = e.target;
    if (t.dataset && t.dataset.tpl) {
      const group = t.dataset.tpl;
      const idx = t.value;
      const target = t.dataset.target;
      const i = Number(t.dataset.i);
      if (idx !== '' && window.FATHOM) {
        const tplObj = (window.FATHOM.promptTemplates[group] || [])[Number(idx)];
        if (tplObj) { current.steps[i].config = current.steps[i].config || {}; current.steps[i].config[target] = tplObj.prompt; renderBuild(); }
      }
      return;
    }
    if (t.dataset && t.dataset.field === 'name') { current.name = t.value; return; }
    if (t.hasAttribute && t.hasAttribute('data-cfg')) {
      const i = Number(t.dataset.i);
      const k = t.dataset.k;
      current.steps[i].config = current.steps[i].config || {};
      current.steps[i].config[k] = t.value;
      const sum = root.querySelector('#rtSummary');
      if (sum) sum.innerHTML = summaryHTML();
    }
  }

  function defaults(type) {
    const cfg = {};
    (STEP_TYPES[type].fields || []).forEach((f) => { if (f.def != null) cfg[f.k] = f.def; });
    return cfg;
  }

  async function save() {
    const payload = { name: current.name || 'Untitled', description: current.description || '', steps: current.steps, enabled: true };
    try {
      const url = current.id ? '/api/routines/' + current.id : '/api/routines';
      const method = current.id ? 'PUT' : 'POST';
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await r.json();
      if (!j.success) throw new Error(j.error || 'Save failed');
      current = j.routine;
      await load();
      toast('Routine saved', 'ok');
    } catch (e) { toast(e.message, 'err'); }
  }

  async function run() {
    if (!current.steps.length) return toast('Add at least one step', 'err');
    if (!current.id) await save();
    if (!current.id) return;
    try {
      const r = await fetch('/api/routines/' + current.id + '/run', { method: 'POST' });
      const j = await r.json();
      if (!j.success) throw new Error(j.error || 'Run failed');
      toast('Run started, watch Operations', 'ok');
    } catch (e) { toast(e.message, 'err'); }
  }

  function showSchedule() {
    if (!current.id) return toast('Save the routine first', 'err');
    const host = root.querySelector('#rtSchedule');
    host.innerHTML = `
      <div class="rt-runbar" style="border-top:none;padding-top:6px">
        <select class="form-input" id="rtCronSel" style="max-width:240px">
          <option value="*/15 * * * *">Every 15 minutes</option>
          <option value="0 * * * *">Hourly</option>
          <option value="0 7 * * *" selected>Daily at 07:00</option>
          <option value="0 9 * * 1">Mondays at 09:00</option>
        </select>
        <button class="btn signal" data-action="setSchedule">Set schedule</button>
      </div>`;
  }

  async function setSchedule(cron) {
    try {
      const r = await fetch('/api/routines/' + current.id + '/schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cron }) });
      const j = await r.json();
      if (!j.success) throw new Error(j.error || 'Schedule failed');
      root.querySelector('#rtSchedule').innerHTML = '';
      toast('Scheduled', 'ok');
    } catch (e) { toast(e.message, 'err'); }
  }

  async function remove() {
    if (!current.id) { newRoutine(); return; }
    try {
      await fetch('/api/routines/' + current.id, { method: 'DELETE' });
      current = null;
      await load();
      toast('Routine deleted', 'ok');
    } catch (e) { toast(e.message, 'err'); }
  }

  // helpers
  function setText(id, v) { const e = root.querySelector('#' + id); if (e) e.textContent = v; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function escAttr(s) { return esc(s); }
  function toast(msg, type) {
    const d = document.createElement('div');
    d.className = 'toast ' + (type || '');
    d.textContent = msg;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 2600);
  }

  window.Routines = { init };
})();
