// "Send SMS" step via a pluggable HTTP gateway. Channel-agnostic: point it at a
// self-hosted Android SMS gateway, a Gammu/SMS server, or any provider that
// accepts an HTTP POST. Configured entirely through .env, so there is no vendor
// lock-in and nothing proprietary is hardcoded.
//
//   SMS_GATEWAY_URL        required, e.g. http://192.168.1.50:8080/message
//   SMS_GATEWAY_METHOD     default POST
//   SMS_GATEWAY_AUTH       optional, sent as the Authorization header
//   SMS_GATEWAY_TO_FIELD   payload field for the number   (default "phone")
//   SMS_GATEWAY_TEXT_FIELD payload field for the message  (default "message")
const { wait, getField, renderTemplate } = require('./_shared');
const store = require('../store');

// Gateway config comes from the UI settings (SQLite) first, then .env as fallback.
function gatewayConfig() {
  let s = {};
  try { s = store.settings.getAll(); } catch (e) { s = {}; }
  return {
    url: s.sms_gateway_url || process.env.SMS_GATEWAY_URL || '',
    method: (s.sms_gateway_method || process.env.SMS_GATEWAY_METHOD || 'POST').toUpperCase(),
    toField: s.sms_gateway_to_field || process.env.SMS_GATEWAY_TO_FIELD || 'phone',
    textField: s.sms_gateway_text_field || process.env.SMS_GATEWAY_TEXT_FIELD || 'message',
    auth: s.sms_gateway_auth || process.env.SMS_GATEWAY_AUTH || ''
  };
}

async function sendSms(rows = [], config = {}, ctx = {}) {
  const onProgress = ctx.onProgress || (() => {});
  const isCancelled = ctx.isCancelled || (() => false);
  const log = ctx.log || (() => {});

  const { url, method, toField, textField, auth } = gatewayConfig();
  if (!url) throw new Error('sendSms: SMS gateway not configured (set it in the SMS panel or .env)');
  const bodyTpl = config.message || '';
  const throttleMs = Number(config.throttleMs) || 1500;

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i++) {
    if (isCancelled()) break;
    const row = rows[i];
    const phone = getField(row, 'phone');
    const name = getField(row, 'name') || phone;
    onProgress(Math.floor((i / Math.max(rows.length, 1)) * 100), `Texting ${i + 1}/${rows.length}`);

    if (!String(phone).trim()) { failed++; continue; }
    try {
      const text = bodyTpl ? renderTemplate(bodyTpl, row) : (getField(row, 'message') || '');
      const headers = { 'Content-Type': 'application/json' };
      if (auth) headers['Authorization'] = auth;
      const res = await fetch(url, { method, headers, body: JSON.stringify({ [toField]: phone, [textField]: text }) });
      if (!res.ok) throw new Error(`gateway responded ${res.status}`);
      sent++;
      log(`SMS to ${name}`, 'success');
    } catch (err) {
      failed++;
      log(`SMS failed ${name}: ${err.message}`, 'error');
    }
    await wait(throttleMs);
  }

  onProgress(100, `Sent ${sent}, failed ${failed}`);
  return { rows, sent, failed, total: rows.length };
}

module.exports = { sendSms };
