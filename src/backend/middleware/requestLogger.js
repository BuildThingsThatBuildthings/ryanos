const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');

const requestLogger = (req, res, next) => {
  // Add unique request ID
  req.requestId = uuidv4();
  
  // Start time for response time calculation
  const start = Date.now();

  // Log request
  logger.info('Incoming request', {
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length'),
    referer: req.get('Referer'),
    // Only log body for non-sensitive routes
    body: shouldLogBody(req) ? req.body : '[REDACTED]'
  });

  // Capture the original res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    // Calculate response time
    const responseTime = Date.now() - start;
    
    // Log response
    logger.info('Request completed', {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      contentLength: res.get('Content-Length')
    });

    // Call original end method
    originalEnd.call(this, chunk, encoding);
  };

  // Add request ID to response headers
  res.set('X-Request-ID', req.requestId);

  next();
};

// Helper function to determine if request body should be logged
const shouldLogBody = (req) => {
  const sensitiveRoutes = ['/auth/login', '/auth/register', '/auth/reset-password'];
  const sensitiveFields = ['password', 'token', 'secret', 'key'];
  
  // Don't log body for sensitive routes
  if (sensitiveRoutes.some(route => req.path.includes(route))) {
    return false;
  }

  // Don't log if body contains sensitive fields
  if (req.body && typeof req.body === 'object') {
    const bodyKeys = Object.keys(req.body).join(' ').toLowerCase();
    if (sensitiveFields.some(field => bodyKeys.includes(field))) {
      return false;
    }
  }

  // Don't log large bodies
  const contentLength = parseInt(req.get('Content-Length') || 0);
  if (contentLength > 1024) { // 1KB
    return false;
  }

  return true;
};

module.exports = requestLogger;