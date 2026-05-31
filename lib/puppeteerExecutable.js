async function resolveExecutablePath(puppeteerModule) {
  if (!puppeteerModule || typeof puppeteerModule.executablePath !== 'function') {
    throw new Error('A Puppeteer module with executablePath() is required');
  }

  const executablePath = await puppeteerModule.executablePath();

  if (!executablePath || typeof executablePath !== 'string') {
    throw new Error('Puppeteer executablePath() did not return a browser path');
  }

  return executablePath;
}

module.exports = {
  resolveExecutablePath
};
