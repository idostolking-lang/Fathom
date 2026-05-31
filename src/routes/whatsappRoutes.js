const express = require('express');
const fs = require('fs');
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const { resolveExecutablePath } = require('../../lib/puppeteerExecutable');
const store = require('../../lib/store');

function createWhatsAppRoutes({ taskManager, projectRoot }) {
  const router = express.Router();

  let whatsappClient = null;
  let isWhatsAppReady = false;
  let qrCodeData = null;
  let commandHandler = null;

  async function initializeWhatsApp() {
    // Get Chromium path from our installed puppeteer
    const puppeteerModule = require('puppeteer');
    const executablePath = await resolveExecutablePath(puppeteerModule);
    
    whatsappClient = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        headless: true,
        executablePath: executablePath,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    });

    whatsappClient.on('qr', async (qr) => {
      console.log('📱 WhatsApp QR Code generated');
      qrCodeData = await qrcode.toDataURL(qr);
    });

    whatsappClient.on('ready', () => {
      console.log('✅ WhatsApp Client is ready!');
      isWhatsAppReady = true;
      qrCodeData = null;
    });

    whatsappClient.on('authenticated', () => {
      console.log('🔐 WhatsApp authenticated');
    });

    whatsappClient.on('auth_failure', () => {
      console.log('❌ WhatsApp authentication failed');
      isWhatsAppReady = false;
    });

    whatsappClient.on('disconnected', () => {
      console.log('🔌 WhatsApp disconnected');
      isWhatsAppReady = false;
    });

    // Incoming command messages from the authorized phone number (set in Settings).
    whatsappClient.on('message', async (msg) => {
      try {
        if (!commandHandler) return;
        const cfg = String(store.settings.get('whatsapp_command_number') || '').replace(/\D/g, '');
        if (cfg.length < 7) return;
        const from = String(msg.from || '').replace(/\D/g, '');
        const authed = from === cfg || from.endsWith(cfg) || cfg.endsWith(from);
        if (!authed) return;
        const reply = await commandHandler(msg.body || '');
        if (reply) await msg.reply(reply);
      } catch (err) {
        console.error('WhatsApp command error:', err.message);
      }
    });

    whatsappClient.initialize();
  }

  // Send a message to a phone number (used by notifications and the send step).
  async function sendMessage(phone, message) {
    if (!isWhatsAppReady || !whatsappClient) throw new Error('WhatsApp is not connected');
    let cleaned = String(phone).replace(/[^\d+]/g, '');
    if (cleaned.startsWith('0')) cleaned = '972' + cleaned.substring(1);
    if (cleaned.startsWith('+')) cleaned = cleaned.substring(1);
    await whatsappClient.sendMessage(`${cleaned}@c.us`, message);
  }

  function setCommandHandler(fn) { commandHandler = fn; }
  // WhatsApp Status Endpoint
  router.get('/whatsapp/status', (req, res) => {
    res.json({
      isReady: isWhatsAppReady,
      qrCode: qrCodeData
    });
  });

  // Send WhatsApp Message Endpoint
  router.post('/whatsapp/send', async (req, res) => {
    try {
      const { phone, message } = req.body;

      if (!phone || !message) {
        return res.status(400).json({ 
          success: false, 
          error: 'Phone and message are required' 
        });
      }

      if (!isWhatsAppReady) {
        return res.status(503).json({ 
          success: false, 
          error: 'WhatsApp is not ready. Please scan QR code first.' 
        });
      }

      // Clean phone number
      let cleanedPhone = phone.replace(/[^\d+]/g, '');
      if (cleanedPhone.startsWith('0')) {
        cleanedPhone = '972' + cleanedPhone.substring(1);
      }
      if (cleanedPhone.startsWith('+')) {
        cleanedPhone = cleanedPhone.substring(1);
      }

      // Format for WhatsApp
      const chatId = `${cleanedPhone}@c.us`;

      // Send message
      await whatsappClient.sendMessage(chatId, message);

      console.log(`✅ Message sent to ${phone}`);
      res.json({ success: true, phone: phone });

    } catch (error) {
      console.error('Error sending WhatsApp message:', error.message);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // Restart WhatsApp Connection (Disconnect and clear session)
  router.post('/whatsapp/restart', async (req, res) => {
    try {
      console.log('🔄 Disconnecting WhatsApp and clearing session...');
      
      // Destroy the client
      if (whatsappClient) {
        await whatsappClient.destroy();
        whatsappClient = null;
      }
      
      // Reset state
      isWhatsAppReady = false;
      qrCodeData = null;
      
      // Delete the session directory to force fresh authentication
      const sessionPath = path.join(projectRoot, '.wwebjs_auth');
      if (fs.existsSync(sessionPath)) {
        console.log('🗑️ Removing old session data...');
        fs.rmSync(sessionPath, { recursive: true, force: true });
        console.log('✅ Session data removed');
      }
      
      // Wait a bit before reinitializing
      setTimeout(() => {
        console.log('🔄 Initializing fresh WhatsApp connection...');
        initializeWhatsApp();
      }, 1000);
      
      res.json({ success: true, message: 'WhatsApp disconnected. Scan QR code with new device.' });
    } catch (error) {
      console.error('Error restarting WhatsApp:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Analyze Websites with AI

  router.post('/whatsapp/send-bulk', async (req, res) => {
    const { leads, message, runInBackground } = req.body;
    
    if (!leads || leads.length === 0) {
      return res.status(400).json({ error: 'No leads provided' });
    }
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    if (!isWhatsAppReady) {
      return res.status(400).json({ error: 'WhatsApp is not connected' });
    }
    
    // If running in background, create task and return immediately
    if (runInBackground) {
      const task = taskManager.createTask(
        'whatsapp',
        `WhatsApp Bulk: ${leads.length} messages`,
        { leads, message }
      );
      
      res.json({
        success: true,
        taskId: task.id
      });
      
      // Run sending in background
      runWhatsAppBulkSenderInBackground(task.id, leads, message);
      return;
    }
    
    // Normal execution (if needed)
    res.json({ success: true, message: 'Bulk sending started' });
  });

  // Background WhatsApp bulk sender function
  async function runWhatsAppBulkSenderInBackground(taskId, leads, message) {
    try {
      taskManager.updateTaskStatus(taskId, 'running', 'Starting WhatsApp bulk sending...');
      taskManager.updateTaskProgress(taskId, 5);
      
      console.log(`[Task ${taskId}] WhatsApp bulk sending to ${leads.length} leads...`);
      
      let sent = 0;
      let failed = 0;
      
      for (let i = 0; i < leads.length; i++) {
        const lead = leads[i];
        const progress = 10 + Math.floor((i / leads.length) * 85);
        const name = lead.Name || lead.name || 'Unknown';
        const phone = lead.Phone || lead.phone || '';
        
        taskManager.updateTaskProgress(taskId, progress, `Sending ${i + 1}/${leads.length} to ${name}`);
        
        if (!phone || phone.trim() === '') {
          failed++;
          continue;
        }
        
        try {
          const phoneNumber = phone.replace(/\D/g, '');
          const chatId = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@c.us`;
          
          await whatsappClient.sendMessage(chatId, message);
          sent++;
          console.log(`[Task ${taskId}] ✅ Sent to ${name} (${phone})`);
          
          // Delay between messages (3-5 seconds)
          await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 2000));
          
        } catch (error) {
          failed++;
          console.error(`[Task ${taskId}] ❌ Failed to send to ${name}:`, error.message);
        }
      }
      
      taskManager.completeTask(taskId, {
        sent,
        failed,
        total: leads.length
      });
      
      console.log(`[Task ${taskId}] WhatsApp bulk sending complete! Sent: ${sent}, Failed: ${failed}`);
      
    } catch (error) {
      console.error(`[Task ${taskId}] WhatsApp bulk sending error:`, error.message);
      taskManager.failTask(taskId, error);
    }
  }

  // ===== EMAIL BULK SENDER ENDPOINT =====


  return {
    router,
    initializeWhatsApp,
    sendMessage,
    setCommandHandler,
    getStatus: () => ({ isReady: isWhatsAppReady, qrCode: qrCodeData })
  };
}

module.exports = { createWhatsAppRoutes };
