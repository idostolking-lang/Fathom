const express = require('express');
const cors = require('cors');
const path = require('path');
const { config } = require('../../lib/config');
const { createOpenAIClient } = require('../../lib/openaiClient');
const {
  createAccessMiddleware,
  createCorsOptions,
  extractAccessToken,
  getAccessToken,
  validateAccessConfiguration
} = require('../../lib/accessControl');
const taskManager = require('../tasks/taskManager');
const taskRoutes = require('../tasks/taskRoutes');
const { createAiRoutes } = require('../routes/aiRoutes');
const { createEmailRoutes } = require('../routes/emailRoutes');
const { createInstagramRoutes } = require('../routes/instagramRoutes');
const { createScrapingRoutes } = require('../routes/scrapingRoutes');
const { createWhatsAppRoutes } = require('../routes/whatsappRoutes');
const { getDb } = require('../../lib/db');
const { createDataRoutes } = require('../routes/dataRoutes');
const { createRoutineRoutes } = require('../routes/routineRoutes');
const { createSmsRoutes } = require('../routes/smsRoutes');
const { RoutineEngine } = require('../routines/engine');
const { Scheduler } = require('../routines/scheduler');
const { createCommandBridge } = require('../whatsapp/commandBridge');
const store = require('../../lib/store');

function createApp(options = {}) {
  const appConfig = options.config || config;
  const projectRoot = options.projectRoot || path.resolve(__dirname, '..', '..');
  const accessToken = validateAccessConfiguration(appConfig);
  const openai = options.openai || createOpenAIClient(appConfig);
  const app = express();

  getDb(); // open SQLite and ensure schema before serving any request

  const whatsappRoutes = createWhatsAppRoutes({ taskManager, projectRoot });

  // Notify the authorized WhatsApp number when a routine run finishes.
  const notify = async ({ routine, status, output, error }) => {
    try {
      const s = store.settings.getAll();
      if (s.whatsapp_notify !== 'on' || !s.whatsapp_command_number) return;
      const msg = status === 'completed'
        ? `Fathom: routine "${routine.name}" finished${output && output.rows != null ? ' (' + output.rows + ' rows)' : ''}.`
        : `Fathom: routine "${routine.name}" failed: ${error}`;
      await whatsappRoutes.sendMessage(s.whatsapp_command_number, msg);
    } catch (e) { /* best-effort */ }
  };

  const routineEngine = new RoutineEngine({ openai, whatsappSend: whatsappRoutes.sendMessage, notify });
  whatsappRoutes.setCommandHandler(createCommandBridge({ engine: routineEngine }).handle);

  app.use(cors(createCorsOptions(appConfig)));
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  app.use(express.static(path.join(projectRoot, 'public')));

  app.get('/api/auth/status', (req, res) => {
    const receivedToken = extractAccessToken(req);
    res.json({
      success: true,
      authRequired: Boolean(getAccessToken(appConfig)),
      authenticated: Boolean(accessToken && receivedToken === accessToken)
    });
  });

  app.use('/api', createAccessMiddleware(appConfig));
  app.use('/api', taskRoutes);
  app.use('/api', createDataRoutes());
  app.use('/api', createRoutineRoutes({ engine: routineEngine }));
  app.use('/api', createScrapingRoutes({ taskManager }));
  app.use('/api', createAiRoutes({ openai }));
  app.use('/api', whatsappRoutes.router);
  app.use('/api', createInstagramRoutes({
    taskManager,
    port: appConfig.port,
    accessToken
  }));
  app.use('/api', createEmailRoutes({ taskManager }));
  app.use('/api', createSmsRoutes({ taskManager }));

  let scheduler = null;
  if (options.startScheduler !== false) {
    scheduler = new Scheduler(routineEngine).start();
  }

  return {
    app,
    config: appConfig,
    taskManager,
    routineEngine,
    scheduler,
    initializeWhatsApp: whatsappRoutes.initializeWhatsApp
  };
}

module.exports = { createApp };
