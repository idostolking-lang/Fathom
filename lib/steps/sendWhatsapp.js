// "Send WhatsApp" step: message each row's phone number.
// Needs a connected WhatsApp client, injected as ctx.whatsappSend(phone, text).
// config: { message, throttleMs }. Template supports {{Name}} etc.
const { wait, getField, renderTemplate } = require('./_shared');

async function sendWhatsapp(rows = [], config = {}, ctx = {}) {
  const onProgress = ctx.onProgress || (() => {});
  const isCancelled = ctx.isCancelled || (() => false);
  const log = ctx.log || (() => {});
  const send = ctx.whatsappSend;

  if (typeof send !== 'function') {
    throw new Error('sendWhatsapp: WhatsApp is not connected. Link it from the Outreach panel, then run again.');
  }

  const bodyTpl = config.message || '';
  const throttleMs = Number(config.throttleMs) || 3000;
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i++) {
    if (isCancelled()) break;
    const row = rows[i];
    const phone = getField(row, 'phone');
    const name = getField(row, 'name') || phone;
    onProgress(Math.floor((i / Math.max(rows.length, 1)) * 100), `Messaging ${i + 1}/${rows.length}`);

    if (!String(phone).trim()) { failed++; continue; }
    try {
      const body = bodyTpl ? renderTemplate(bodyTpl, row) : (getField(row, 'message') || '');
      await send(phone, body);
      sent++;
      log(`Messaged ${name}`, 'success');
    } catch (err) {
      failed++;
      log(`Failed ${name}: ${err.message}`, 'error');
    }
    await wait(throttleMs);
  }

  onProgress(100, `Sent ${sent}, failed ${failed}`);
  return { rows, sent, failed, total: rows.length };
}

module.exports = { sendWhatsapp };
