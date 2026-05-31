// "Send email" step: email each row's address via Gmail SMTP.
// config: { subject, message, throttleMs }. Templates support {{Name}} etc.
// `message` falls back to each row's `Message` column (e.g. from the analyze step).
const nodemailer = require('nodemailer');
const { wait, getField, renderTemplate } = require('./_shared');
const { emailConfig } = require('../emailConfig');

async function sendEmail(rows = [], config = {}, ctx = {}) {
  const onProgress = ctx.onProgress || (() => {});
  const isCancelled = ctx.isCancelled || (() => false);
  const log = ctx.log || (() => {});

  const cfg = emailConfig();
  if (!cfg.user || !cfg.pass) {
    throw new Error('sendEmail: email not configured (set it in Settings or .env)');
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: cfg.user, pass: cfg.pass }
  });

  const subjectTpl = config.subject || 'Hello from {{Name}}';
  const bodyTpl = config.message || '';
  const throttleMs = Number(config.throttleMs) || 2000;

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i++) {
    if (isCancelled()) break;
    const row = rows[i];
    const to = getField(row, 'email');
    const name = getField(row, 'name') || to;
    onProgress(Math.floor((i / Math.max(rows.length, 1)) * 100), `Sending ${i + 1}/${rows.length}`);

    if (!String(to).trim()) { failed++; continue; }
    try {
      const body = bodyTpl ? renderTemplate(bodyTpl, row) : (getField(row, 'message') || '');
      await transporter.sendMail({
        from: `"${cfg.fromName}" <${cfg.user}>`,
        to,
        subject: renderTemplate(subjectTpl, row),
        text: body,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;line-height:1.6;color:#222">${body.replace(/\n/g, '<br>')}</div>`
      });
      sent++;
      log(`Sent to ${name}`, 'success');
    } catch (err) {
      failed++;
      log(`Failed ${name}: ${err.message}`, 'error');
    }
    await wait(throttleMs);
  }

  onProgress(100, `Sent ${sent}, failed ${failed}`);
  return { rows, sent, failed, total: rows.length };
}

module.exports = { sendEmail };
