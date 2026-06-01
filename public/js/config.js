// Fathom client config: the model lineup and the prompt-template library.
// Edit this one file to change which models appear in every picker, or to add
// or tweak the ready-made prompt templates offered across the AI features.
window.FATHOM = window.FATHOM || {};

// OpenAI chat models offered in the model selectors. All accept the standard
// chat params this app uses. Add or remove entries freely.
window.FATHOM.models = [
  { id: 'gpt-4o', label: 'GPT-4o' },
  { id: 'gpt-4o-mini', label: 'GPT-4o mini (fast, cheap)' },
  { id: 'gpt-4.1', label: 'GPT-4.1' },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
  { id: 'gpt-4.1-nano', label: 'GPT-4.1 nano (fastest)' }
];
window.FATHOM.defaultModel = 'gpt-4o';

// Build <option> markup for a <select>, optionally marking one selected.
window.FATHOM.modelOptions = function (selected) {
  const sel = selected || window.FATHOM.defaultModel;
  return window.FATHOM.models
    .map((m) => `<option value="${m.id}"${m.id === sel ? ' selected' : ''}>${m.label}</option>`)
    .join('');
};

// Ready-made prompt templates, grouped by where they apply. Each is { name, prompt }.
window.FATHOM.promptTemplates = {
  // Website / business analysis (Specific Search, Routines "analyze")
  websiteAnalysis: [
    { name: 'Services & pricing audit', prompt: 'Identify the services this business offers, any pricing or packages mentioned, and gaps where they could add or clarify their offering. Be specific and cite what you saw on the site.' },
    { name: 'Web presence critique', prompt: 'Assess the website for design quality, clarity, mobile-friendliness, load feel, and calls to action. List concrete, prioritized improvements.' },
    { name: 'Decision-maker & contact', prompt: 'Find the owner or key contact, their role, and the best way to reach them. Note any team, about, or contact information present.' },
    { name: 'Fit for our offer', prompt: 'Evaluate whether this business is a strong fit for a website redesign and marketing help. Explain why or why not, and what angle would resonate.' }
  ],
  // Outreach openers (Generate message, marketing message, Routines "analyze")
  outreach: [
    { name: 'Friendly intro (web)', prompt: 'Write a short, warm cold-outreach opener offering to improve their website. Reference something specific about the business. Three sentences, no fluff, plain text.' },
    { name: 'Problem-led', prompt: 'Open by naming a likely problem for this kind of business, then hint that we can solve it. Concrete, respectful, brief.' },
    { name: 'Compliment-first', prompt: 'Start with a genuine, specific compliment about the business, then offer help. Friendly and concise.' }
  ],
  // Message / conversation analysis (Analyze Messages)
  messageAnalysis: [
    { name: 'Sentiment & intent', prompt: 'Analyze the tone, sentiment, and intent across these messages. Flag frustration, buying signals, and risks, with short quotes as evidence.' },
    { name: 'Summary & action items', prompt: 'Summarize the conversation in a few bullets, then list clear action items and follow-ups with owners where possible.' },
    { name: 'Negotiation read', prompt: "Assess each party's position, leverage, and likely next move, then suggest a concrete response." }
  ],
  // Consultant chat behavior (system persona)
  consultant: [
    { name: 'Sales strategist', prompt: 'You are a sharp B2B sales strategist. Give concrete, prioritized advice. Ask for any missing context before assuming.' },
    { name: 'Marketing copywriter', prompt: 'You are a concise marketing copywriter. Produce ready-to-use copy, then briefly explain the choices.' },
    { name: 'Market analyst', prompt: 'You are a market analyst. Be data-driven, state your assumptions, and end with actionable conclusions.' }
  ]
};

// Build <option> markup for a template group (first option is a placeholder).
window.FATHOM.templateOptions = function (group) {
  const list = (window.FATHOM.promptTemplates[group] || []);
  return ['<option value="">Prompt templates...</option>']
    .concat(list.map((t, i) => `<option value="${i}">${t.name}</option>`))
    .join('');
};

// Saved tables live in two stores: the legacy localStorage `savedTables` value
// (written by the results page) and the SQLite-backed /api/tables. A read must
// NEVER drop a table that exists in only one store. Merge by a stable signature,
// keep row data when either side has it, write the union back to localStorage,
// and return it. Every "select a table" view should read through this.
window.FATHOM.mergeSavedTables = function (apiTables) {
  let local = [];
  try { local = JSON.parse(localStorage.getItem('savedTables') || '[]'); } catch (_e) { local = []; }
  if (!Array.isArray(local)) local = [];
  if (!Array.isArray(apiTables)) apiTables = [];
  const sig = (t) => [t && t.name, t && t.url, (t && t.count != null) ? t.count : (Array.isArray(t && t.data) ? t.data.length : '')].join('|');
  const order = [];
  const map = new Map();
  const upsert = (t) => {
    if (!t || typeof t !== 'object') return;
    const key = sig(t);
    if (!map.has(key)) { map.set(key, Object.assign({}, t)); order.push(key); return; }
    const cur = map.get(key);
    if (!Array.isArray(cur.data) && Array.isArray(t.data)) cur.data = t.data;
    if (cur.id == null && t.id != null) cur.id = t.id;
    if (!cur.date && t.date) cur.date = t.date;
    if (cur.count == null && t.count != null) cur.count = t.count;
    if (!cur.url && t.url) cur.url = t.url;
  };
  local.forEach(upsert);     // local first, so a table saved only on this device survives
  apiTables.forEach(upsert); // then the API fills in fields / adds server-side tables
  const merged = order.map((k) => map.get(k));
  try { localStorage.setItem('savedTables', JSON.stringify(merged)); } catch (_e) {}
  return merged;
};

// The built-in defaults above are the fallback. Any model lineup configured in
// the UI (Settings) is stored server-side and applied here on startup.
window.FATHOM.applyServerSettings = async function () {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    const s = data.settings || {};
    if (s.models) {
      const parsed = JSON.parse(s.models);
      if (Array.isArray(parsed) && parsed.length) window.FATHOM.models = parsed;
    }
    if (s.default_model) window.FATHOM.defaultModel = s.default_model;
  } catch (e) { /* keep built-in defaults */ }
};
window.FATHOM.applyServerSettings();
