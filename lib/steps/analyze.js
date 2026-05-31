// "Analyze" step: draft a short outreach message per business with the AI.
// Adds a `Message` column to each row. Requires an OpenAI client on ctx.
const { getField } = require('./_shared');

const DEFAULT_INSTRUCTIONS =
  'You write concise, friendly cold-outreach openers (3-4 sentences) for a small agency reaching local businesses. No greetings like "Dear", no emojis, plain text.';

async function analyze(rows = [], config = {}, ctx = {}) {
  const openai = ctx.openai;
  const onProgress = ctx.onProgress || (() => {});
  const isCancelled = ctx.isCancelled || (() => false);
  const log = ctx.log || (() => {});
  if (!openai) throw new Error('analyze: AI is not configured (set OPENAI_API_KEY)');

  const instructions = config.instructions || DEFAULT_INSTRUCTIONS;
  const model = config.model || 'gpt-4o';
  const out = [];

  for (let i = 0; i < rows.length; i++) {
    if (isCancelled()) break;
    const row = rows[i];
    const name = getField(row, 'name') || 'there';
    onProgress(Math.floor((i / Math.max(rows.length, 1)) * 100), `Drafting ${i + 1}/${rows.length}: ${name}`);
    try {
      const completion = await openai.chat.completions.create({
        model,
        temperature: 0.7,
        max_tokens: 220,
        messages: [
          { role: 'system', content: instructions },
          { role: 'user', content: `Business: ${name}\nWebsite: ${getField(row, 'website') || 'n/a'}\nAddress: ${getField(row, 'address') || 'n/a'}\n\nWrite the outreach message.` }
        ]
      });
      out.push({ ...row, Message: completion.choices?.[0]?.message?.content?.trim() || '' });
    } catch (err) {
      log(`AI draft failed for ${name}: ${err.message}`, 'error');
      out.push({ ...row, Message: '', error: err.message });
    }
  }

  onProgress(100, `Drafted ${out.length} messages`);
  return out;
}

module.exports = { analyze };
