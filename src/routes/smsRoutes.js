// SMS API over the pluggable HTTP gateway (see lib/steps/sendSms.js).
const express = require('express');
const { sendSms } = require('../../lib/steps/sendSms');
const store = require('../../lib/store');

function createSmsRoutes({ taskManager }) {
  const router = express.Router();

  router.get('/sms/status', (req, res) => {
    let configured = Boolean(process.env.SMS_GATEWAY_URL);
    try { configured = configured || Boolean(store.settings.get('sms_gateway_url')); } catch (e) { /* db not ready */ }
    res.json({ success: true, configured });
  });

  router.post('/sms/send', async (req, res) => {
    const { phone, message } = req.body || {};
    if (!phone || !message) return res.status(400).json({ success: false, error: 'phone and message are required' });
    try {
      const result = await sendSms([{ Phone: phone }], { message }, {});
      res.json({ success: result.sent > 0, ...result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/sms/send-bulk', async (req, res) => {
    const { recipients, message, runInBackground } = req.body || {};
    if (!recipients || recipients.length === 0) return res.status(400).json({ success: false, error: 'No recipients provided' });
    if (!message) return res.status(400).json({ success: false, error: 'Message is required' });

    if (runInBackground) {
      const task = taskManager.createTask('sms', `SMS bulk: ${recipients.length} recipients`, { count: recipients.length });
      res.json({ success: true, taskId: task.id });
      sendSms(recipients, { message }, {
        onProgress: (p, m) => taskManager.updateTaskProgress(task.id, p, m),
        isCancelled: () => !taskManager.getTask(task.id),
        log: (m, t) => taskManager.addTaskLog(task.id, m, t)
      }).then((r) => taskManager.completeTask(task.id, r)).catch((e) => taskManager.failTask(task.id, e));
      return;
    }

    try {
      const result = await sendSms(recipients, { message }, {});
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}

module.exports = { createSmsRoutes };
