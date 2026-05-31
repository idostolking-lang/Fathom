// Barrel of composable routine steps. Each step is a small unit that takes
// (rows, config, ctx) and returns the next working set (array) or a summary
// object with a `rows` field. ctx carries { onProgress, log, isCancelled,
// openai, whatsappSend }.
const { discover } = require('./discover');
const { filter } = require('./filter');
const { enrich } = require('./enrich');
const { analyze } = require('./analyze');
const { sendEmail } = require('./sendEmail');
const { sendWhatsapp } = require('./sendWhatsapp');
const { sendSms } = require('./sendSms');
const { save } = require('./save');

module.exports = { discover, filter, enrich, analyze, sendEmail, sendWhatsapp, sendSms, save };
