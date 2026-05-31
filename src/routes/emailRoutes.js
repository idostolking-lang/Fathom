const express = require('express');
const { enrich } = require('../../lib/steps/enrich');
const { emailConfig, emailConfigured } = require('../../lib/emailConfig');

// Map an enriched business row to the response shape the current UI expects.
function toLegacy(row) {
  const website = row.Website || row.website || '';
  return {
    name: row.Name || row.name || 'Unknown',
    website: website.trim() ? website : 'N/A',
    email: row.Email || row.email || '',
    phone: row.Phone || row.phone || '',
    address: row.Address || row.address || ''
  };
}

function createEmailRoutes({ taskManager }) {
  const router = express.Router();

  // Extract contact emails from a set of business websites (shared enrich step).
  router.post('/extract-emails', async (req, res) => {
    const { businesses, runInBackground } = req.body;
    if (!businesses || businesses.length === 0) {
      return res.status(400).json({ success: false, error: 'No businesses provided' });
    }

    if (runInBackground) {
      const task = taskManager.createTask('email', `Email Extraction: ${businesses.length} websites`, { businesses, total: businesses.length });
      res.json({ success: true, taskId: task.id });
      runEmailExtractionInBackground(task.id, businesses);
      return;
    }

    try {
      const enriched = await enrich(businesses, {}, {});
      const results = enriched.map(toLegacy);
      const emailsFound = results.filter((r) => r.email && r.email.trim()).length;
      res.json({ success: true, results, emailsFound, totalProcessed: businesses.length });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  async function runEmailExtractionInBackground(taskId, businesses) {
    try {
      taskManager.updateTaskStatus(taskId, 'running', 'Starting email extraction...');
      const enriched = await enrich(businesses, {}, {
        onProgress: (progress, message) => taskManager.updateTaskProgress(taskId, progress, message),
        isCancelled: () => !taskManager.getTask(taskId),
        log: (message, type) => taskManager.addTaskLog(taskId, message, type)
      });
      const results = enriched.map(toLegacy);
      const emailsFound = results.filter((r) => r.email && r.email.trim()).length;
      taskManager.completeTask(taskId, { results, emailsFound, totalProcessed: businesses.length });
    } catch (error) {
      taskManager.failTask(taskId, error);
    }
  }

  // ===== EMAIL SENDING =====
  router.post('/send-email', async (req, res) => {
    try {
      const { to, subject, message, recipientName } = req.body;
      if (!to || !subject || !message) {
        return res.status(400).json({ success: false, error: 'Missing required fields: to, subject, message' });
      }
      const cfg = emailConfig();
      if (!cfg.user || !cfg.pass) {
        return res.status(500).json({ success: false, error: 'Email not configured. Set it in Settings, or EMAIL_USER / EMAIL_PASS in .env.' });
      }

      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: cfg.user, pass: cfg.pass }
      });

      await transporter.sendMail({
        from: `"${cfg.fromName}" <${cfg.user}>`,
        to,
        subject,
        text: message,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
            <p style="font-size: 16px; line-height: 1.6; color: #333;">
              ${message.replace(/\n/g, '<br>')}
            </p>
          </div>
        `
      });

      console.log(`Email sent to ${recipientName || to}`);
      res.json({ success: true, message: `Email sent to ${to}` });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/email/status', (req, res) => {
    res.json({ success: true, configured: emailConfigured() });
  });

  router.post('/email/send-bulk', async (req, res) => {
    const { recipients, subject, message, runInBackground } = req.body;
    if (!recipients || recipients.length === 0) return res.status(400).json({ error: 'No recipients provided' });
    if (!subject || !message) return res.status(400).json({ error: 'Subject and message are required' });

    if (runInBackground) {
      const task = taskManager.createTask('email', `Email Bulk: ${recipients.length} emails`, { recipients, subject, message });
      res.json({ success: true, taskId: task.id });
      runEmailBulkSenderInBackground(task.id, recipients, subject, message);
      return;
    }
    res.json({ success: true, message: 'Bulk sending started' });
  });

  async function runEmailBulkSenderInBackground(taskId, recipients, subject, message) {
    try {
      taskManager.updateTaskStatus(taskId, 'running', 'Starting email bulk sending...');
      const cfg = emailConfig();
      if (!cfg.user || !cfg.pass) {
        throw new Error('Email not configured. Set it in Settings, or EMAIL_USER / EMAIL_PASS in .env');
      }
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: cfg.user, pass: cfg.pass }
      });

      let sent = 0;
      let failed = 0;
      for (let i = 0; i < recipients.length; i++) {
        const recipient = recipients[i];
        const name = recipient.Name || recipient.name || 'Unknown';
        const email = recipient.Email || recipient.email || '';
        taskManager.updateTaskProgress(taskId, 10 + Math.floor((i / recipients.length) * 85), `Sending ${i + 1}/${recipients.length} to ${name}`);

        if (!email || !email.trim()) { failed++; continue; }
        try {
          await transporter.sendMail({
            from: `"${cfg.fromName}" <${cfg.user}>`,
            to: email,
            subject,
            text: message,
            html: `<div style="font-family:Arial,sans-serif;max-width:600px;line-height:1.6;color:#222">${message.replace(/\n/g, '<br>')}</div>`
          });
          sent++;
          await new Promise((resolve) => setTimeout(resolve, 2000 + Math.random() * 1000));
        } catch (error) {
          failed++;
        }
      }

      taskManager.completeTask(taskId, { sent, failed, total: recipients.length });
    } catch (error) {
      taskManager.failTask(taskId, error);
    }
  }

  return router;
}

module.exports = { createEmailRoutes };
