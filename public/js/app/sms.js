// Bulk SMS sender: a multi-step wizard that mirrors the WhatsApp lead sender.
// Pick a saved table, choose recipients (rows with a phone), compose a templated
// message ({{Name}} placeholders), then dispatch via /api/sms/send-bulk running
// in the background (watch Operations). A Gateway-setup section, reachable from
// the header, configures the pluggable HTTP SMS gateway via /api/settings.
//
// The modal is JS-injected on first open and reused afterwards.
// Public API: window.SmsSender = { open }.  fetch is wrapped by authFetch.js.
(function () {
  let overlay = null;
  let configured = false;

  // ---- wizard state ----
  const state = {
    tables: [],          // table summaries from /api/tables
    table: null,         // hydrated table { id, name, count, data: [...] }
    columns: [],         // available column keys for placeholder hints
    recipients: [],      // rows that have a phone (the selectable pool)
    selected: new Set()  // indices into recipients that are checked
  };

  const TO_FIELD_DEFAULT = 'phone';
  const TEXT_FIELD_DEFAULT = 'message';

  // ---- small helpers ----
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  // Tolerant field read (Name / name), matching the server's getField.
  function field(row, key) {
    if (!row || !key) return '';
    if (row[key] != null) return row[key];
    const cap = key.charAt(0).toUpperCase() + key.slice(1);
    const low = key.toLowerCase();
    const v = row[cap] != null ? row[cap] : row[low];
    return v == null ? '' : v;
  }

  function phoneOf(row) { return String(field(row, 'phone')).trim(); }
  function nameOf(row) { return String(field(row, 'name')).trim() || 'Unknown'; }

  // Render {{field}} placeholders against a row, matching the server template.
  function renderTemplate(tpl, row) {
    return String(tpl || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => String(field(row, key)));
  }

  function q(sel) { return overlay ? overlay.querySelector(sel) : null; }
  function qa(sel) { return overlay ? Array.prototype.slice.call(overlay.querySelectorAll(sel)) : []; }

  function setStatus(msg, kind) {
    const el = q('#smsStatus');
    if (!el) return;
    el.className = 'status' + (kind ? ' ' + kind : '');
    el.innerHTML = msg ? '<span class="dot"></span>' + esc(msg) : '';
    el.style.display = msg ? 'inline-flex' : 'none';
  }

  // ============================================================
  // Build (once)
  // ============================================================
  function build() {
    overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'smsSenderModal';
    overlay.innerHTML = `
      <div class="modal-container large-modal">
        <div class="modal-header">
          <h2 id="smsTitle">Send SMS</h2>
          <div style="display:flex;align-items:center;gap:10px">
            <button class="btn ghost sm" data-sms="toggle-setup" id="smsSetupToggle">Gateway setup</button>
            <button class="modal-close" data-sms="close" aria-label="Close">&times;</button>
          </div>
        </div>

        <div class="steps-indicator" id="smsSteps">
          <div class="step active" data-step="1">
            <div class="step-number">1</div>
            <div class="step-label">Table</div>
          </div>
          <div class="step-line"></div>
          <div class="step" data-step="2">
            <div class="step-number">2</div>
            <div class="step-label">Recipients</div>
          </div>
          <div class="step-line"></div>
          <div class="step" data-step="3">
            <div class="step-number">3</div>
            <div class="step-label">Compose</div>
          </div>
          <div class="step-line"></div>
          <div class="step" data-step="4">
            <div class="step-number">4</div>
            <div class="step-label">Send</div>
          </div>
        </div>

        <div class="modal-body">
          <div id="smsBanner"></div>

          <!-- Step 1: select table -->
          <div class="sms-step active" id="smsStep1">
            <h3>Select a saved table</h3>
            <p>Choose which table holds the contacts you want to text.</p>
            <div id="smsTablesList" style="display:flex;flex-direction:column;gap:12px"></div>
            <div id="smsNoTables" class="rt-empty" style="display:none">
              No saved tables yet. Scrape or import some data first.
            </div>
          </div>

          <!-- Step 2: select recipients -->
          <div class="sms-step" id="smsStep2">
            <h3>Select recipients</h3>
            <p>Only rows that have a phone number are listed. Untick anyone you want to skip.</p>
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap">
              <button class="btn ghost sm" data-sms="select-all">Select all</button>
              <button class="btn ghost sm" data-sms="select-none">Select none</button>
              <span class="status run" id="smsSelCount" style="margin-left:auto">
                <span class="dot"></span><span id="smsSelCountN">0</span> selected
              </span>
            </div>
            <div id="smsRecipients" style="max-height:340px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;border:1px solid var(--hairline);border-radius:var(--r);padding:10px;background:var(--ground)"></div>
            <div id="smsNoPhones" class="rt-empty" style="display:none">
              None of the rows in this table have a phone number.
            </div>
            <div class="step-actions">
              <button class="btn ghost" data-sms="back-to-1">Back</button>
              <button class="btn signal" data-sms="to-compose">Continue</button>
            </div>
          </div>

          <!-- Step 3: compose -->
          <div class="sms-step" id="smsStep3">
            <h3>Compose your message</h3>
            <p>Use placeholders like <span class="field-tag">{{Name}}</span> to personalize each text.</p>
            <div class="form-group">
              <label for="smsMessage">Message</label>
              <textarea class="form-input" id="smsMessage" rows="6" placeholder="Hi {{Name}}, ..."></textarea>
            </div>
            <div id="smsPlaceholders" style="margin-bottom:16px"></div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px">
              <button class="btn-generate-ai" data-sms="ai" id="smsAiBtn" type="button">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
                </svg>
                Generate with AI
              </button>
            </div>
            <div class="form-group">
              <label>Preview (first recipient)</label>
              <div id="smsPreview" class="rt-summary" style="margin:0">Type a message to see a preview...</div>
            </div>
            <div class="step-actions">
              <button class="btn ghost" data-sms="back-to-2">Back</button>
              <button class="btn signal" data-sms="send">Send to <span id="smsSendCount">0</span> recipients</button>
            </div>
          </div>

          <!-- Step 4: sending / result -->
          <div class="sms-step" id="smsStep4">
            <div id="smsResult" style="text-align:center;padding:20px 0"></div>
          </div>

          <!-- Gateway setup (overlay panel, toggled from header) -->
          <div class="sms-step" id="smsSetup">
            <h3>SMS gateway setup</h3>
            <div class="rt-summary" style="margin:0 0 20px">
              A self-hosted SMS gateway is a small app that exposes an HTTP endpoint and sends texts for you,
              for example an Android phone running an HTTP SMS gateway app on your network.
              For every recipient, Fathom POSTs JSON like <b>{ phone, message }</b> (using the field names you
              set below, with your optional Authorization header) to that URL. Configure it once here and bulk
              SMS will route through it. You can also set <b>SMS_GATEWAY_URL</b> (and the matching
              <b>SMS_GATEWAY_*</b> vars) in <b>.env</b> as a fallback.
            </div>
            <div class="form-group">
              <label for="cfgUrl">Gateway URL</label>
              <input type="text" class="form-input" id="cfgUrl" placeholder="http://192.168.1.50:8080/message">
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
              <div class="form-group">
                <label for="cfgMethod">HTTP method</label>
                <select class="form-input" id="cfgMethod">
                  <option value="POST">POST</option>
                  <option value="GET">GET</option>
                  <option value="PUT">PUT</option>
                </select>
              </div>
              <div class="form-group">
                <label for="cfgAuth">Authorization header (optional)</label>
                <input type="text" class="form-input" id="cfgAuth" placeholder="Bearer abc123 / Basic ...">
              </div>
              <div class="form-group">
                <label for="cfgToField">Phone field name</label>
                <input type="text" class="form-input" id="cfgToField" placeholder="${TO_FIELD_DEFAULT}">
              </div>
              <div class="form-group">
                <label for="cfgTextField">Message field name</label>
                <input type="text" class="form-input" id="cfgTextField" placeholder="${TEXT_FIELD_DEFAULT}">
              </div>
            </div>
            <div class="step-actions">
              <button class="btn ghost" data-sms="setup-back">Back</button>
              <button class="btn signal" data-sms="setup-save">Save gateway</button>
              <span class="status" id="smsSetupStatus" style="display:none"></span>
            </div>
          </div>

          <div class="rt-runbar" id="smsRunbar" style="margin-top:18px">
            <span class="status" id="smsStatus" style="display:none"></span>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', onClick);
    q('#smsMessage').addEventListener('input', updatePreview);
  }

  // Single delegated click handler keyed off data-sms.
  function onClick(e) {
    if (e.target === overlay) { close(); return; }
    const a = e.target.closest('[data-sms]');
    if (!a) return;
    const action = a.dataset.sms;
    switch (action) {
      case 'close': close(); break;
      case 'toggle-setup': {
        close();
        const setNav = document.querySelector('.rail .nav[data-screen="settings"]');
        if (setNav) setNav.click();
        if (window.Settings && window.Settings.openGateway) window.Settings.openGateway();
        break;
      }
      case 'setup-back': showStep(1); break;
      case 'setup-save': saveGateway(); break;
      case 'back-to-1': showStep(1); break;
      case 'back-to-2': showStep(2); break;
      case 'select-all': setAllRecipients(true); break;
      case 'select-none': setAllRecipients(false); break;
      case 'to-compose': goToCompose(); break;
      case 'send': send(); break;
      case 'ai': generateAi(); break;
      default: break;
    }
  }

  // ============================================================
  // Open / close
  // ============================================================
  async function open() {
    if (!overlay) build();
    overlay.classList.add('active');
    resetState();
    showStep(1);
    setStatus('');
    await refreshStatus();
    loadTables();
  }

  function close() { if (overlay) overlay.classList.remove('active'); }

  function resetState() {
    state.table = null;
    state.columns = [];
    state.recipients = [];
    state.selected = new Set();
  }

  // ---- step / view switching ----
  // Steps 1-4 are the wizard; 'setup' is a side panel that hides the indicator.
  function showStep(step) {
    qa('.sms-step').forEach((el) => el.classList.remove('active'));
    const map = { 1: 'smsStep1', 2: 'smsStep2', 3: 'smsStep3', 4: 'smsStep4', setup: 'smsSetup' };
    const el = q('#' + (map[step] || 'smsStep1'));
    if (el) el.classList.add('active');

    const indicator = q('#smsSteps');
    const runbar = q('#smsRunbar');
    if (step === 'setup') {
      if (indicator) indicator.style.display = 'none';
      if (runbar) runbar.style.display = 'none';
      q('#smsSetupToggle').textContent = 'Back to sender';
    } else {
      if (indicator) indicator.style.display = 'flex';
      if (runbar) runbar.style.display = 'flex';
      q('#smsSetupToggle').textContent = 'Gateway setup';
      // mark indicator progress
      qa('#smsSteps .step').forEach((s) => {
        const n = Number(s.dataset.step);
        s.classList.toggle('active', n === Number(step));
        s.classList.toggle('completed', n < Number(step));
      });
    }
  }

  function toggleSetup() {
    const onSetup = q('#smsSetup').classList.contains('active');
    if (onSetup) { showStep(1); } else { openSetup(); }
  }

  // ============================================================
  // Gateway status + setup
  // ============================================================
  async function refreshStatus() {
    const banner = q('#smsBanner');
    try {
      const r = await fetch('/api/sms/status');
      const j = await r.json();
      configured = !!(j && j.configured);
    } catch (_e) {
      configured = false;
    }
    if (!banner) return;
    if (configured) {
      banner.innerHTML = '';
    } else {
      banner.innerHTML = `
        <div class="rt-summary" style="border-color:var(--alert);color:var(--text-mid);margin:0 0 20px">
          <b style="color:var(--alert)">SMS gateway not configured.</b>
          Set it up before sending.
          <a href="#" data-sms="toggle-setup" style="color:var(--signal)">Open gateway setup</a>.
        </div>`;
    }
  }

  async function openSetup() {
    showStep('setup');
    // Load current values from settings.
    try {
      const r = await fetch('/api/settings');
      const j = await r.json();
      const s = (j && j.settings) || {};
      q('#cfgUrl').value = s.sms_gateway_url || '';
      q('#cfgMethod').value = (s.sms_gateway_method || 'POST').toUpperCase();
      q('#cfgAuth').value = s.sms_gateway_auth || '';
      q('#cfgToField').value = s.sms_gateway_to_field || '';
      q('#cfgTextField').value = s.sms_gateway_text_field || '';
    } catch (_e) { /* leave blank */ }
  }

  async function saveGateway() {
    const st = q('#smsSetupStatus');
    const payload = {
      sms_gateway_url: q('#cfgUrl').value.trim(),
      sms_gateway_method: (q('#cfgMethod').value || 'POST').toUpperCase(),
      sms_gateway_auth: q('#cfgAuth').value.trim(),
      sms_gateway_to_field: q('#cfgToField').value.trim() || TO_FIELD_DEFAULT,
      sms_gateway_text_field: q('#cfgTextField').value.trim() || TEXT_FIELD_DEFAULT
    };
    st.style.display = 'inline-flex';
    st.className = 'status run';
    st.innerHTML = '<span class="dot"></span>Saving...';
    try {
      const r = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const j = await r.json();
      if (!j || !j.success) throw new Error((j && j.error) || 'Save failed');
      st.className = 'status done';
      st.innerHTML = '<span class="dot"></span>Saved';
      await refreshStatus();
    } catch (e) {
      st.className = 'status';
      st.style.color = 'var(--alert)';
      st.innerHTML = '<span class="dot"></span>' + esc(e.message);
    }
  }

  // ============================================================
  // Step 1: tables
  // ============================================================
  async function loadTables() {
    const list = q('#smsTablesList');
    const empty = q('#smsNoTables');
    list.innerHTML = '<div class="rt-empty">Loading tables...</div>';
    empty.style.display = 'none';

    try {
      const r = await fetch('/api/tables');
      const j = await r.json();
      state.tables = (j && j.tables) || [];
    } catch (_e) {
      state.tables = [];
    }

    list.innerHTML = '';
    if (!state.tables.length) {
      empty.style.display = 'block';
      return;
    }

    state.tables.forEach((t) => {
      const card = document.createElement('div');
      card.className = 'table-select-card';
      card.style.display = 'flex';
      card.style.justifyContent = 'space-between';
      card.style.alignItems = 'center';
      const dateStr = t.date ? new Date(t.date).toLocaleDateString() : '';
      card.innerHTML = `
        <div>
          <div style="font-size:16px;font-weight:700;color:var(--text-hi);margin-bottom:6px">${esc(t.name)}</div>
          <div class="mono" style="font-size:11px;color:var(--text-low);display:flex;gap:14px">
            <span>${Number(t.count || 0)} rows</span>
            ${dateStr ? '<span>' + esc(dateStr) + '</span>' : ''}
          </div>
        </div>
        <span class="table-select-badge">${Number(t.count || 0)}</span>`;
      card.addEventListener('click', () => selectTable(t));
      list.appendChild(card);
    });
  }

  async function selectTable(summary) {
    setStatus('Loading rows...', 'run');
    let table = summary;
    // The list endpoint omits `data`; hydrate the full row.
    if (!Array.isArray(table.data)) {
      try {
        const r = await fetch('/api/tables/' + summary.id);
        const j = await r.json();
        if (j && j.success && j.table) table = j.table;
      } catch (_e) { /* fall through with summary */ }
    }
    const rows = Array.isArray(table.data) ? table.data : [];
    state.table = table;

    // Recipients = rows that carry a phone.
    state.recipients = rows.filter((row) => phoneOf(row) !== '');
    state.selected = new Set(state.recipients.map((_r, i) => i));

    // Available columns for placeholder hints (union across rows).
    const cols = new Set();
    rows.forEach((row) => Object.keys(row || {}).forEach((k) => cols.add(k)));
    state.columns = Array.from(cols);

    setStatus('');
    q('#smsTitle').textContent = 'Send SMS - ' + table.name;
    renderRecipients();
    showStep(2);
  }

  // ============================================================
  // Step 2: recipients
  // ============================================================
  function renderRecipients() {
    const box = q('#smsRecipients');
    const empty = q('#smsNoPhones');
    box.innerHTML = '';

    if (!state.recipients.length) {
      box.style.display = 'none';
      empty.style.display = 'block';
      updateSelectedCount();
      return;
    }
    box.style.display = 'flex';
    empty.style.display = 'none';

    state.recipients.forEach((row, i) => {
      const label = document.createElement('label');
      label.className = 'business-checkbox';
      label.innerHTML = `
        <input type="checkbox" data-idx="${i}" ${state.selected.has(i) ? 'checked' : ''}>
        <div class="business-checkbox-info">
          <div class="business-checkbox-name">${esc(nameOf(row))}</div>
          <div class="business-checkbox-phone mono">${esc(phoneOf(row))}</div>
        </div>`;
      const cb = label.querySelector('input');
      cb.addEventListener('change', () => {
        if (cb.checked) state.selected.add(i); else state.selected.delete(i);
        updateSelectedCount();
      });
      box.appendChild(label);
    });
    updateSelectedCount();
  }

  function setAllRecipients(on) {
    state.selected = on ? new Set(state.recipients.map((_r, i) => i)) : new Set();
    qa('#smsRecipients input[type="checkbox"]').forEach((cb) => { cb.checked = on; });
    updateSelectedCount();
  }

  function updateSelectedCount() {
    const n = state.selected.size;
    const cn = q('#smsSelCountN');
    if (cn) cn.textContent = String(n);
    const sc = q('#smsSendCount');
    if (sc) sc.textContent = String(n);
  }

  function selectedRows() {
    return state.recipients.filter((_r, i) => state.selected.has(i));
  }

  function goToCompose() {
    if (state.selected.size === 0) {
      setStatus('Select at least one recipient first.', '');
      return;
    }
    setStatus('');
    renderPlaceholders();
    updatePreview();
    showStep(3);
  }

  // ============================================================
  // Step 3: compose
  // ============================================================
  function renderPlaceholders() {
    const box = q('#smsPlaceholders');
    if (!box) return;
    if (!state.columns.length) { box.innerHTML = ''; return; }
    const tags = state.columns
      .map((c) => `<span class="field-tag" data-ph="${esc(c)}" style="cursor:pointer">{{${esc(c)}}}</span>`)
      .join(' ');
    box.innerHTML = `
      <div class="mono" style="font-size:10.5px;letter-spacing:1px;text-transform:uppercase;color:var(--text-low);margin-bottom:8px">Available placeholders (click to insert)</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">${tags}</div>`;
    box.querySelectorAll('[data-ph]').forEach((tag) => {
      tag.addEventListener('click', () => insertPlaceholder('{{' + tag.dataset.ph + '}}'));
    });
  }

  function insertPlaceholder(token) {
    const ta = q('#smsMessage');
    const start = ta.selectionStart != null ? ta.selectionStart : ta.value.length;
    const end = ta.selectionEnd != null ? ta.selectionEnd : ta.value.length;
    ta.value = ta.value.slice(0, start) + token + ta.value.slice(end);
    const pos = start + token.length;
    ta.focus();
    ta.setSelectionRange(pos, pos);
    updatePreview();
  }

  function updatePreview() {
    const ta = q('#smsMessage');
    const prev = q('#smsPreview');
    if (!ta || !prev) return;
    const msg = ta.value;
    if (!msg.trim()) {
      prev.textContent = 'Type a message to see a preview...';
      prev.style.fontStyle = 'italic';
      return;
    }
    prev.style.fontStyle = 'normal';
    const sample = selectedRows()[0] || state.recipients[0] || {};
    prev.textContent = renderTemplate(msg, sample);
  }

  async function generateAi() {
    const ta = q('#smsMessage');
    const btn = q('#smsAiBtn');
    const sample = selectedRows()[0] || state.recipients[0] || {};
    const businessName = nameOf(sample);
    const original = ta.value;
    btn.disabled = true;
    const prevLabel = btn.innerHTML;
    btn.innerHTML = '<span class="btn-loader"></span> Generating...';
    try {
      const r = await fetch('/api/generate-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessName })
      });
      const j = await r.json();
      if (j && j.success && j.suggestion) {
        ta.value = j.suggestion;
        updatePreview();
      } else {
        ta.value = original;
        setStatus((j && j.error) ? 'AI: ' + j.error : 'Could not generate a message.', '');
      }
    } catch (e) {
      ta.value = original;
      setStatus('AI error: ' + e.message, '');
    } finally {
      btn.disabled = false;
      btn.innerHTML = prevLabel;
    }
  }

  // ============================================================
  // Step 4: send (background) + result
  // ============================================================
  async function send() {
    const message = q('#smsMessage').value.trim();
    if (!message) { setStatus('Write a message first.', ''); return; }

    const recipients = selectedRows();
    if (!recipients.length) { setStatus('No recipients selected.', ''); return; }

    if (!configured) {
      // Re-check in case it was configured in another tab, else nudge to setup.
      await refreshStatus();
      if (!configured) {
        setStatus('Gateway not configured.', '');
        openSetup();
        return;
      }
    }

    setStatus('Starting...', 'run');
    showStep(4);
    renderSending(recipients.length);

    try {
      const r = await fetch('/api/sms/send-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients, message, runInBackground: true })
      });
      const j = await r.json();
      if (!j || !j.success) throw new Error((j && j.error) || 'Send failed');
      renderStarted(recipients.length, j.taskId);
      setStatus('');
    } catch (e) {
      renderError(e.message);
      setStatus('');
    }
  }

  function renderSending(total) {
    q('#smsResult').innerHTML = `
      <div class="loader" style="margin-bottom:20px"></div>
      <h3>Dispatching ${total} message${total === 1 ? '' : 's'}...</h3>
      <p>Handing the batch to the gateway.</p>`;
  }

  function renderStarted(total, taskId) {
    q('#smsResult').innerHTML = `
      <svg width="72" height="72" viewBox="0 0 80 80" fill="none" style="margin:0 auto 20px;color:var(--live)">
        <circle cx="40" cy="40" r="36" fill="currentColor" opacity="0.15"/>
        <circle cx="40" cy="40" r="32" stroke="currentColor" stroke-width="4" opacity="0.3"/>
        <path d="M28 40L36 48L52 30" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <h3>SMS run started</h3>
      <p>${total} message${total === 1 ? '' : 's'} are sending in the background.
      Track progress in <b style="color:var(--signal)">Operations</b>.</p>
      ${taskId ? '<div class="mono" style="font-size:11px;color:var(--text-low);margin-top:8px">Task ' + esc(taskId) + '</div>' : ''}
      <div class="step-actions" style="justify-content:center">
        <button class="btn ghost" data-sms="close">Close</button>
        <button class="btn signal" data-sms="back-to-1">Send another batch</button>
      </div>`;
  }

  function renderError(msg) {
    q('#smsResult').innerHTML = `
      <h3 style="color:var(--alert)">Could not start the SMS run</h3>
      <p>${esc(msg)}</p>
      <div class="step-actions" style="justify-content:center">
        <button class="btn ghost" data-sms="back-to-2">Back</button>
        <button class="btn ghost" data-sms="toggle-setup">Gateway setup</button>
      </div>`;
  }

  window.SmsSender = { open };
})();
