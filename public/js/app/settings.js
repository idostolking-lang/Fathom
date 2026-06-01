// Settings screen: manage the AI model lineup and configure the SMS gateway
// (guided, with presets + a test send). Renders into #settingsRoot.
(function () {
  let inited = false;
  let root;

  // Gateway presets: each prefills the fields and shows tailored steps.
  const PRESETS = {
    android: {
      label: 'Android phone gateway (recommended)',
      fields: { method: 'POST', to: 'phone', text: 'message' },
      steps: [
        'On a spare Android phone, install an HTTP SMS gateway app (search F-Droid or Play for "SMS Gateway").',
        'Open the app and start its server. It shows a local address like http://192.168.1.50:8080.',
        'Paste that address plus the send path the app documents into Gateway URL below.',
        'If the app requires a login, put it in the Authorization header (for example: Basic xxxxx).',
        'Set the field names to match what the app expects, then press Test.'
      ]
    },
    generic: {
      label: 'Generic HTTP endpoint (JSON)',
      fields: { method: 'POST', to: 'phone', text: 'message' },
      steps: [
        'Any URL that accepts a JSON POST and sends an SMS works here.',
        'Fathom POSTs { "phone": "...", "message": "..." } for each recipient.',
        'Rename the two fields below if your endpoint expects different keys.',
        'Add an Authorization header if your endpoint needs a key, then press Test.'
      ]
    },
    provider: {
      label: 'Cloud provider (Twilio-style)',
      fields: { method: 'POST', to: 'To', text: 'Body' },
      steps: [
        "Use your provider's HTTP send endpoint as the Gateway URL.",
        'Put your API credential in the Authorization header.',
        "Match the phone and message field names to the provider's API (Twilio uses To and Body).",
        'Press Test to confirm before any bulk send.'
      ]
    }
  };

  function init() {
    root = document.getElementById('settingsRoot');
    if (!root) return;
    if (!inited) { scaffold(); inited = true; root.addEventListener('click', onClick); }
    renderModels();
    loadEmail();
    loadGateway();
    loadWhatsapp();
  }

  function openGateway() {
    init();
    const g = root.querySelector('#setGateway');
    if (g) g.scrollIntoView({ behavior: 'smooth' });
  }

  function openWhatsapp() {
    init();
    const w = root.querySelector('#setWhatsapp');
    if (w) w.scrollIntoView({ behavior: 'smooth' });
  }

  function scaffold() {
    root.innerHTML = `
      <div class="head">
        <div>
          <div class="crumb">Console <span class="sep">/</span> Settings</div>
          <h1>Settings</h1>
          <p>Configure the AI model lineup and the SMS gateway. Changes are saved to your local database.</p>
        </div>
      </div>

      <div class="panel" style="margin-bottom:18px" id="setModels">
        <div class="ph"><h3>AI models</h3><span class="meta">shown in every model picker</span></div>
        <div style="padding:18px">
          <p style="color:var(--text-mid);margin-bottom:16px;line-height:1.7">The list every model selector reads from. Add the models your OpenAI key has access to; the one marked default is preselected.</p>
          <div id="modelRows" style="display:flex;flex-direction:column;gap:8px"></div>
          <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">
            <button class="btn ghost" data-act="model-add">+ Add model</button>
            <button class="btn signal" data-act="model-save">Save models</button>
            <span class="muted mono" id="modelStatus" style="font-size:11px;align-self:center"></span>
          </div>
        </div>
      </div>

      <div class="panel" id="setEmail" style="margin-top:18px">
        <div class="ph"><h3>Email sending</h3><span class="meta" id="emailState">checking...</span></div>
        <div style="padding:18px">
          <p style="color:var(--text-mid);line-height:1.7;margin-bottom:14px">
            Outreach email goes out through Gmail. Use a Gmail App Password, not your normal password, so your account login is never stored.
          </p>
          <ol style="margin:0 0 18px 18px;color:var(--text-mid);line-height:1.9">
            <li>Turn on 2-Step Verification for your Google account.</li>
            <li>Open Google Account, Security, App passwords, and create one for Mail.</li>
            <li>Paste the 16-character password below (spaces are fine).</li>
          </ol>
          <div class="form-group"><label>Gmail address</label><input class="form-input" id="emUser" placeholder="you@gmail.com"></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
            <div class="form-group"><label>App password</label><input class="form-input" id="emPass" type="password" placeholder="16-character app password"></div>
            <div class="form-group"><label>From name</label><input class="form-input" id="emFrom" placeholder="Fathom"></div>
          </div>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;border-top:1px solid var(--hairline);padding-top:16px">
            <button class="btn signal" data-act="email-save">Save</button>
            <input class="form-input" id="emTestTo" placeholder="test@example.com" style="max-width:200px">
            <button class="btn" data-act="email-test">Send test</button>
            <span class="muted mono" id="emailStatus" style="font-size:11px"></span>
          </div>
        </div>
      </div>

      <div class="panel" id="setGateway" style="margin-top:18px">
        <div class="ph"><h3>SMS gateway</h3><span class="meta" id="gwState">checking...</span></div>
        <div style="padding:18px">
          <p style="color:var(--text-mid);line-height:1.7;margin-bottom:14px">
            An SMS gateway turns an HTTP request into a real text message. The simplest self-hosted option is a small app on a spare Android phone that sends through its SIM. Fathom sends each recipient as a JSON POST to the URL you set here. Pick a setup to get step-by-step guidance.
          </p>
          <div class="form-group">
            <label>Setup type</label>
            <select class="form-input" id="gwPreset">
              <option value="">Choose a setup for guidance...</option>
              <option value="android">Android phone gateway (recommended)</option>
              <option value="generic">Generic HTTP endpoint (JSON)</option>
              <option value="provider">Cloud provider (Twilio-style)</option>
            </select>
          </div>
          <ol id="gwSteps" style="display:none;margin:0 0 18px 18px;color:var(--text-mid);line-height:1.9"></ol>

          <div class="form-group">
            <label>Gateway URL</label>
            <input class="form-input" id="gwUrl" placeholder="http://192.168.1.50:8080/message">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
            <div class="form-group"><label>HTTP method</label><input class="form-input" id="gwMethod" placeholder="POST"></div>
            <div class="form-group"><label>Authorization header (optional)</label><input class="form-input" id="gwAuth" placeholder="Basic abc123 / Bearer ..."></div>
            <div class="form-group"><label>Phone field name</label><input class="form-input" id="gwTo" placeholder="phone"></div>
            <div class="form-group"><label>Message field name</label><input class="form-input" id="gwText" placeholder="message"></div>
          </div>
          <p style="color:var(--text-low);font-size:12.5px;line-height:1.6;margin:4px 0 16px">
            Fathom sends, per recipient: <span class="mono" style="color:var(--text-mid)">{ "&lt;phone field&gt;": number, "&lt;message field&gt;": text }</span> to your URL, with the Authorization header if set.
          </p>

          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;border-top:1px solid var(--hairline);padding-top:16px">
            <button class="btn signal" data-act="gw-save">Save gateway</button>
            <input class="form-input" id="gwTestPhone" placeholder="+1 555 0100" style="max-width:160px">
            <button class="btn" data-act="gw-test">Send test</button>
            <span class="muted mono" id="gwStatus" style="font-size:11px"></span>
          </div>
        </div>
      </div>

      <div class="panel" id="setWhatsapp" style="margin-top:18px">
        <div class="ph"><h3>WhatsApp remote control</h3><span class="meta" id="waLinkState">checking link...</span></div>
        <div style="padding:18px">
          <p style="color:var(--text-mid);line-height:1.7;margin-bottom:14px">
            Control your routines by texting your linked WhatsApp from your phone, and get a message back when a run finishes. Only the number you set below is allowed to send commands.
          </p>
          <ol style="margin:0 0 18px 18px;color:var(--text-mid);line-height:1.9">
            <li>Link WhatsApp first: click the WhatsApp readout in the top bar and scan the QR code.</li>
            <li>Enter the phone number you will text from (your own number), then Save.</li>
            <li>From that number, message your linked WhatsApp the word <span class="mono" style="color:var(--text-hi)">help</span> to see every command.</li>
          </ol>
          <div class="form-group">
            <label>Authorized phone number</label>
            <input class="form-input" id="waNumber" placeholder="+1 555 0100">
          </div>
          <label style="display:flex;align-items:center;gap:10px;color:var(--text-mid);font-size:13px;margin-bottom:16px;cursor:pointer">
            <input type="checkbox" id="waNotify"> Message me when a routine run finishes
          </label>
          <div style="background:var(--ground);border:1px solid var(--hairline);border-radius:var(--r);padding:14px;margin-bottom:16px">
            <div class="mono" style="font-size:10px;letter-spacing:1.2px;text-transform:uppercase;color:var(--text-low);margin-bottom:10px">Commands you can text</div>
            <div class="mono" style="font-size:12px;color:var(--text-mid);line-height:1.9">
              list &middot; run &lt;id or name&gt; &middot; status &middot; runs &lt;id&gt; &middot; schedule &lt;id&gt; &lt;cron&gt; &middot; enable / disable &lt;id&gt; &middot; new &lt;name&gt; &middot; help
            </div>
          </div>
          <div style="display:flex;gap:10px;align-items:center;border-top:1px solid var(--hairline);padding-top:16px">
            <button class="btn signal" data-act="wa-save">Save</button>
            <span class="muted mono" id="waStatus" style="font-size:11px"></span>
          </div>
        </div>
      </div>`;
  }

  // ---------- models ----------
  function renderModels() {
    const wrap = root.querySelector('#modelRows');
    const models = (window.FATHOM && window.FATHOM.models) || [];
    const def = (window.FATHOM && window.FATHOM.defaultModel) || (models[0] && models[0].id);
    wrap.innerHTML = models.map((m, i) => modelRow(m, i, def)).join('');
  }
  function modelRow(m, i, def) {
    return `<div class="model-row" style="display:grid;grid-template-columns:1fr 1.4fr auto auto;gap:8px;align-items:center">
      <input class="form-input" data-mid value="${esc(m.id)}" placeholder="model-id">
      <input class="form-input" data-mlabel value="${esc(m.label || '')}" placeholder="Display label">
      <label class="mono" style="font-size:11px;color:var(--text-mid);display:flex;align-items:center;gap:6px;white-space:nowrap"><input type="radio" name="defModel" value="${esc(m.id)}" ${m.id === def ? 'checked' : ''}> default</label>
      <button class="btn danger sm" data-act="model-del" data-i="${i}">&times;</button>
    </div>`;
  }
  function collectModels() {
    const rows = Array.from(root.querySelectorAll('.model-row'));
    const def = (root.querySelector('input[name="defModel"]:checked') || {}).value;
    const models = rows.map((r) => ({
      id: r.querySelector('[data-mid]').value.trim(),
      label: r.querySelector('[data-mlabel]').value.trim()
    })).filter((m) => m.id);
    return { models, def: def || (models[0] && models[0].id) };
  }
  async function saveModels() {
    const { models, def } = collectModels();
    if (!models.length) { setText('modelStatus', 'Add at least one model'); return; }
    window.FATHOM.models = models;
    window.FATHOM.defaultModel = def;
    try {
      await postSettings({ models: JSON.stringify(models), default_model: def });
      setText('modelStatus', 'Saved. New pickers use this lineup.');
      renderModels();
    } catch (e) { setText('modelStatus', e.message); }
  }

  // ---------- gateway ----------
  async function loadGateway() {
    try {
      const s = (await (await fetch('/api/settings')).json()).settings || {};
      setVal('gwUrl', s.sms_gateway_url); setVal('gwMethod', s.sms_gateway_method);
      setVal('gwAuth', s.sms_gateway_auth); setVal('gwTo', s.sms_gateway_to_field); setVal('gwText', s.sms_gateway_text_field);
    } catch (e) { /* ignore */ }
    try {
      const st = await (await fetch('/api/sms/status')).json();
      const el = root.querySelector('#gwState');
      if (el) { el.textContent = st.configured ? 'configured' : 'not configured'; el.style.color = st.configured ? 'var(--live)' : 'var(--text-low)'; }
    } catch (e) { /* ignore */ }
  }
  function applyPreset(key) {
    const p = PRESETS[key];
    const steps = root.querySelector('#gwSteps');
    if (!p) { steps.style.display = 'none'; return; }
    if (!val('gwMethod')) setVal('gwMethod', p.fields.method);
    if (!val('gwTo')) setVal('gwTo', p.fields.to);
    if (!val('gwText')) setVal('gwText', p.fields.text);
    steps.style.display = 'block';
    steps.innerHTML = p.steps.map((s) => `<li>${esc(s)}</li>`).join('');
  }
  async function saveGateway() {
    try {
      await postSettings({
        sms_gateway_url: val('gwUrl'), sms_gateway_method: val('gwMethod') || 'POST',
        sms_gateway_auth: val('gwAuth'), sms_gateway_to_field: val('gwTo') || 'phone', sms_gateway_text_field: val('gwText') || 'message'
      });
      setText('gwStatus', 'Saved');
      loadGateway();
    } catch (e) { setText('gwStatus', e.message); }
  }
  async function testGateway() {
    const phone = val('gwTestPhone');
    if (!phone) { setText('gwStatus', 'Enter a test number'); return; }
    setText('gwStatus', 'Sending test...');
    await saveGateway();
    try {
      const r = await fetch('/api/sms/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, message: 'Test message from Fathom.' }) });
      const j = await r.json();
      setText('gwStatus', j.success ? 'Test sent. Check the phone.' : ('Failed: ' + (j.error || 'unknown')));
    } catch (e) { setText('gwStatus', e.message); }
  }

  // ---------- email ----------
  async function loadEmail() {
    try {
      const s = (await (await fetch('/api/settings')).json()).settings || {};
      setVal('emUser', s.email_user); setVal('emPass', s.email_pass); setVal('emFrom', s.email_from_name);
    } catch (e) { /* ignore */ }
    try {
      const st = await (await fetch('/api/email/status')).json();
      const el = root.querySelector('#emailState');
      if (el) { el.textContent = st.configured ? 'configured' : 'not configured'; el.style.color = st.configured ? 'var(--live)' : 'var(--text-low)'; }
    } catch (e) { /* ignore */ }
  }
  async function saveEmail() {
    try {
      await postSettings({ email_user: val('emUser'), email_pass: val('emPass'), email_from_name: val('emFrom') || 'Fathom' });
      setText('emailStatus', 'Saved');
      loadEmail();
    } catch (e) { setText('emailStatus', e.message); }
  }
  async function testEmail() {
    const to = val('emTestTo');
    if (!to) { setText('emailStatus', 'Enter a test address'); return; }
    setText('emailStatus', 'Sending test...');
    await saveEmail();
    try {
      const r = await fetch('/api/send-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to, subject: 'Fathom test', message: 'Test email from Fathom.' }) });
      const j = await r.json();
      setText('emailStatus', j.success ? 'Test sent. Check the inbox.' : ('Failed: ' + (j.error || 'unknown')));
    } catch (e) { setText('emailStatus', e.message); }
  }

  // ---------- whatsapp remote control ----------
  async function loadWhatsapp() {
    try {
      const s = (await (await fetch('/api/settings')).json()).settings || {};
      setVal('waNumber', s.whatsapp_command_number);
      const cb = root.querySelector('#waNotify'); if (cb) cb.checked = s.whatsapp_notify === 'on';
    } catch (e) { /* ignore */ }
    try {
      const st = await (await fetch('/api/whatsapp/status')).json();
      const el = root.querySelector('#waLinkState');
      if (el) { el.textContent = st.isReady ? 'WhatsApp linked' : 'WhatsApp not linked'; el.style.color = st.isReady ? 'var(--live)' : 'var(--text-low)'; }
    } catch (e) { /* ignore */ }
  }
  async function saveWhatsapp() {
    const cb = root.querySelector('#waNotify');
    try {
      await postSettings({ whatsapp_command_number: val('waNumber'), whatsapp_notify: (cb && cb.checked) ? 'on' : 'off' });
      setText('waStatus', 'Saved. Text your linked WhatsApp "help".');
    } catch (e) { setText('waStatus', e.message); }
  }

  // ---------- events ----------
  function onClick(e) {
    const t = e.target.closest('[data-act]');
    if (!t) {
      if (e.target.id === 'gwPreset') return;
      return;
    }
    const a = t.dataset.act;
    if (a === 'model-add') { window.FATHOM.models = collectModels().models.concat([{ id: '', label: '' }]); renderModels(); }
    else if (a === 'model-del') { const m = collectModels().models; m.splice(Number(t.dataset.i), 1); window.FATHOM.models = m; renderModels(); }
    else if (a === 'model-save') saveModels();
    else if (a === 'gw-save') saveGateway();
    else if (a === 'gw-test') testGateway();
    else if (a === 'email-save') saveEmail();
    else if (a === 'email-test') testEmail();
    else if (a === 'wa-save') saveWhatsapp();
  }

  // ---------- helpers ----------
  function postSettings(obj) {
    return fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) }).then((r) => r.json()).then((j) => { if (!j.success) throw new Error(j.error || 'Save failed'); return j; });
  }
  function val(id) { const e = root.querySelector('#' + id); return e ? e.value.trim() : ''; }
  function setVal(id, v) { const e = root.querySelector('#' + id); if (e) e.value = v || ''; }
  function setText(id, v) { const e = root.querySelector('#' + id); if (e) e.textContent = v; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  window.Settings = { init, openGateway, openWhatsapp };
  window.openWhatsappAdmin = function () {
    const nav = document.querySelector('.rail .nav[data-screen="settings"]');
    if (nav) nav.click();
    openWhatsapp();
  };
  // preset change (delegated separately since select change isn't a click)
  if (typeof document.addEventListener === 'function') {
    document.addEventListener('change', (e) => { if (e.target && e.target.id === 'gwPreset') applyPreset(e.target.value); });
  }
})();
