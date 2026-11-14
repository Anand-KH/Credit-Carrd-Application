import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';

/**
 * Security headers via helmet. The API only serves JSON, so the CSP forbids
 * loading or framing anything. HSTS is sent only in production, where the API
 * is expected to be behind HTTPS.
 */
export function createSecurityHeaders({ enableHsts = false } = {}) {
  const helmetMiddleware = helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
    referrerPolicy: { policy: 'no-referrer' },
    frameguard: { action: 'deny' },
    strictTransportSecurity: enableHsts
      ? { maxAge: 31536000, includeSubDomains: true }
      : false,
  });

  return (request, response, next) => {
    // helmet has no Permissions-Policy support, so set it alongside.
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    return helmetMiddleware(request, response, next);
  };
}

/**
 * Rate limiter built on express-rate-limit. Uses the default in-memory store,
 * which is per process; for multiple instances pass a shared store (e.g.
 * rate-limit-redis) via `store`. Responses keep the API's standard error shape.
 */
export function createRateLimiter({
  windowMs = 15 * 60 * 1000,
  max = 20,
  skipSuccessfulRequests = false,
  message = 'Too many requests. Please try again later.',
  store,
} = {}) {
  return rateLimit({
    windowMs,
    limit: max,
    skipSuccessfulRequests,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    ...(store ? { store } : {}),
    handler: (request, response, _next, options) => {
      response.status(options.statusCode).json({
        error: {
          code: 'RATE_LIMITED',
          message,
          requestId: request.id,
        },
      });
    },
  });
}

export const defaultRateLimits = {
  // Every /api request, per client IP.
  api: { windowMs: 15 * 60 * 1000, max: 300 },
  // Everything under /api/auth (register, login, me), per client IP.
  auth: { windowMs: 15 * 60 * 1000, max: 30 },
  // Failed sign-ins only, per client IP: the brute-force guard.
  loginFailures: { windowMs: 15 * 60 * 1000, max: 10 },
};
