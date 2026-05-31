// Shared helpers for routine steps.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Read a business field tolerant of capitalization (Name / name).
function getField(row, field) {
  if (!row || !field) return '';
  if (row[field] != null) return row[field];
  const cap = field.charAt(0).toUpperCase() + field.slice(1);
  const low = field.toLowerCase();
  return row[cap] ?? row[low] ?? '';
}

// Replace {{field}} placeholders in a template string using a row's values.
function renderTemplate(tpl, row) {
  return String(tpl || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => String(getField(row, key) ?? ''));
}

module.exports = { UA, wait, getField, renderTemplate };
