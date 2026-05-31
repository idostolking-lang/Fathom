const { config } = require('../../lib/config');
const { createApp } = require('./createApp');

function startServer(options = {}) {
  const runtime = createApp({ config: options.config || config });
  const { app, initializeWhatsApp } = runtime;
  const port = runtime.config.port;
  const host = runtime.config.host;

  const server = app.listen(port, host, () => {
    console.log(`Data Scraper server running on http://${host}:${port}`);
    console.log(`Local URL: http://localhost:${port}`);
    console.log('Initializing WhatsApp...');
    initializeWhatsApp();
    console.log('Instagram: Manual connection required (use "Connect to Instagram" button)');

    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      console.log('Email sender configured from environment.');
    } else {
      console.log('Email not configured. Set EMAIL_USER and EMAIL_PASS in .env file.');
    }
  });

  return { ...runtime, server };
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer };
