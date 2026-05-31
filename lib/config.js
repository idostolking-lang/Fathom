require('dotenv').config();

function parsePort(value, fallback = 7000) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(`Invalid PORT value: ${value}`);
  }

  return parsed;
}

function createConfig(env = process.env) {
  return {
    port: parsePort(env.PORT),
    host: env.HOST || '0.0.0.0',
    nodeEnv: env.NODE_ENV || 'development',
    openaiApiKey: env.OPENAI_API_KEY || '',
    emailUser: env.EMAIL_USER || '',
    emailPass: env.EMAIL_PASS || '',
    emailFromName: env.EMAIL_FROM_NAME || 'Lead Sender',
    sessionSecret: env.SESSION_SECRET || '',
    appAccessToken: env.APP_ACCESS_TOKEN || '',
    allowedOrigins: env.ALLOWED_ORIGINS || ''
  };
}

function requireConfigValue(source, name, message) {
  const camelName = name.toLowerCase().replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  const value = source[name] ?? source[camelName];

  if (!value || String(value).trim() === '') {
    throw new Error(message || `${name} is required`);
  }

  return String(value);
}

const config = createConfig();

module.exports = {
  config,
  createConfig,
  parsePort,
  requireConfigValue
};
