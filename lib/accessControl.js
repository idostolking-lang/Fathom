const net = require('net');

function isLoopbackHost(host) {
  const normalized = String(host || '').toLowerCase();
  return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(normalized);
}

function isPrivateOrTailscaleHost(host) {
  const normalized = String(host || '').replace(/^\[|\]$/g, '');

  if (isLoopbackHost(normalized)) return true;
  if (net.isIP(normalized) !== 4) return false;

  const parts = normalized.split('.').map(Number);
  const [first, second] = parts;

  return (
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 100 && second >= 64 && second <= 127)
  );
}

function splitList(value) {
  return String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function getAccessToken(config) {
  return config.appAccessToken || '';
}

function validateAccessConfiguration(config) {
  const token = getAccessToken(config);
  const host = config.host || '0.0.0.0';

  if (!token && !isLoopbackHost(host)) {
    throw new Error(
      'APP_ACCESS_TOKEN is required when HOST is not loopback. ' +
      'Set APP_ACCESS_TOKEN in .env before exposing the app on LAN or Tailscale.'
    );
  }

  return token;
}

function extractAccessToken(req) {
  const headerValue = req.get?.('x-app-access-token') || req.headers?.['x-app-access-token'];
  const authHeader = req.get?.('authorization') || req.headers?.authorization || '';
  const bearerMatch = /^Bearer\s+(.+)$/i.exec(authHeader);

  return (
    headerValue ||
    bearerMatch?.[1] ||
    ''
  );
}

function createAccessMiddleware(config) {
  const expectedToken = getAccessToken(config);

  return function accessMiddleware(req, res, next) {
    if (!expectedToken || req.method === 'OPTIONS') {
      return next();
    }

    const receivedToken = extractAccessToken(req);
    if (receivedToken === expectedToken) {
      return next();
    }

    return res.status(401).json({
      success: false,
      error: 'Access token required'
    });
  };
}

function createCorsOptions(config) {
  const explicitOrigins = new Set(splitList(config.allowedOrigins));

  return {
    credentials: false,
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (explicitOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      try {
        const parsed = new URL(origin);
        const samePort = !parsed.port || Number(parsed.port) === Number(config.port);
        if (samePort && isPrivateOrTailscaleHost(parsed.hostname)) {
          callback(null, true);
          return;
        }
      } catch (_error) {
        // Fall through to reject malformed origins.
      }

      callback(null, false);
    }
  };
}

module.exports = {
  createAccessMiddleware,
  createCorsOptions,
  extractAccessToken,
  getAccessToken,
  isPrivateOrTailscaleHost,
  validateAccessConfiguration
};
