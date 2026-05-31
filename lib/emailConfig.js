// Email (Gmail SMTP) configuration: UI settings (SQLite) first, then .env fallback.
// Keeps the credential resolution in one place for the routes and the send step.
const store = require('./store');

function emailConfig() {
  let s = {};
  try { s = store.settings.getAll(); } catch (e) { s = {}; }
  return {
    user: s.email_user || process.env.EMAIL_USER || '',
    pass: s.email_pass || process.env.EMAIL_PASS || '',
    fromName: s.email_from_name || process.env.EMAIL_FROM_NAME || 'Fathom'
  };
}

function emailConfigured() {
  const c = emailConfig();
  return Boolean(c.user && c.pass);
}

module.exports = { emailConfig, emailConfigured };
