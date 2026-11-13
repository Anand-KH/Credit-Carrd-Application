import { afterEach, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcrypt';
import bcryptjs from 'bcryptjs';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import { hasForbiddenKey } from '../src/models/audit-log.model.js';
import { createAuthService } from '../src/services/auth.service.js';

const jwtSecret = 'test-secret-with-more-than-thirty-two-characters';

function mockResponse() {
  const headers = {};
  return {
    headers,
    setHeader: (name, value) => { headers[name] = value; },
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
    headersSent: false,
  };
}

describe('security hardening', () => {
  const servers = [];
  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))));
  });

  async function startApp(options = {}) {
    const app = createApp({
      config: {
        port: 0,
        nodeEnv: 'test',
        allowedOrigins: ['http://localhost:4200'],
        jwtSecret,
        creditLimit300kTo500k: 1000000,
        creditLimit300kTo500kRequiresConfirmation: true,
        ...options.config,
      },
      logger: { info: vi.fn(), error: vi.fn() },
      ...options,
    });
    const server = app.listen(0);
    servers.push(server);
    await new Promise((resolve) => server.once('listening', resolve));
    return `http://127.0.0.1:${server.address().port}`;
  }

  it('sends helmet security headers, with HSTS only in production', async () => {
    const devUrl = await startApp();
    const dev = await fetch(`${devUrl}/api/health`);
    expect(dev.headers.get('content-security-policy')).toMatch(/default-src 'none';\s*frame-ancestors 'none'/);
    expect(dev.headers.get('x-frame-options')).toBe('DENY');
    expect(dev.headers.get('x-content-type-options')).toBe('nosniff');
    expect(dev.headers.get('referrer-policy')).toBe('no-referrer');
    expect(dev.headers.get('permissions-policy')).toContain('camera=()');
    expect(dev.headers.get('x-powered-by')).toBeNull();
    expect(dev.headers.get('strict-transport-security')).toBeNull();

    const prodUrl = await startApp({ config: { nodeEnv: 'production' } });
    const prod = await fetch(`${prodUrl}/api/health`);
    expect(prod.headers.get('strict-transport-security')).toContain('max-age=31536000');
  });

  it('applies the general API limit but never throttles health checks', async () => {
    const baseUrl = await startApp({ rateLimits: { api: { max: 2 } } });
    for (let i = 0; i < 2; i += 1) {
      expect((await fetch(`${baseUrl}/api/missing`)).status).toBe(404);
    }
    const limited = await fetch(`${baseUrl}/api/missing`);
    expect(limited.status).toBe(429);
    expect(limited.headers.get('ratelimit-policy')).toBeTruthy();
    await expect(limited.json()).resolves.toMatchObject({ error: { code: 'RATE_LIMITED' } });
    expect((await fetch(`${baseUrl}/api/health`)).status).toBe(200);
  });

  it('limits failed sign-ins without counting successful ones', async () => {
    const authService = {
      login: vi.fn(async ({ password }) => {
        if (password !== 'correct-password') {
          throw Object.assign(new Error('Email or password is incorrect.'), {
            status: 401,
            code: 'INVALID_CREDENTIALS',
          });
        }
        return { accessToken: 'token' };
      }),
    };
    const baseUrl = await startApp({ authService, rateLimits: { loginFailures: { max: 2 } } });
    const attempt = (password) => fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.test', password }),
    });

    expect((await attempt('correct-password')).status).toBe(200);
    expect((await attempt('correct-password')).status).toBe(200);
    expect((await attempt('wrong-password')).status).toBe(401);
    expect((await attempt('wrong-password')).status).toBe(401);
    const blocked = await attempt('wrong-password');
    expect(blocked.status).toBe(429);
    await expect(blocked.json()).resolves.toMatchObject({
      error: { message: 'Too many failed sign-in attempts. Please try again later.' },
    });
  });

  it('verifies password hashes created by bcryptjs (existing users keep working)', async () => {
    const legacyHash = bcryptjs.hashSync('existing-user-password', 4);
    await expect(bcrypt.compare('existing-user-password', legacyHash)).resolves.toBe(true);
    await expect(bcrypt.compare('not-the-password', legacyHash)).resolves.toBe(false);
  });

  it('parses TRUST_PROXY values', () => {
    const base = { JWT_SECRET: jwtSecret };
    expect(loadConfig(base).trustProxy).toBe(false);
    expect(loadConfig({ ...base, TRUST_PROXY: 'true' }).trustProxy).toBe(true);
    expect(loadConfig({ ...base, TRUST_PROXY: '1' }).trustProxy).toBe(1);
    expect(loadConfig({ ...base, TRUST_PROXY: 'loopback' }).trustProxy).toBe('loopback');
  });

  it('detects sensitive audit metadata keys regardless of case', () => {
    expect(hasForbiddenKey({ passwordHash: 'x' })).toBe(true);
    expect(hasForbiddenKey({ nested: { PanNumber: 'x' } })).toBe(true);
    expect(hasForbiddenKey({ fullPAN: 'x' })).toBe(true);
    expect(hasForbiddenKey({ reason: 'safe' })).toBe(false);
  });

  it('logs the source location, not the message, for unexpected errors', () => {
    const logger = { error: vi.fn() };
    errorHandler(logger)(new Error('applicant PAN ABCDE1234F'), { id: 'r-1' }, mockResponse(), vi.fn());
    const [, fields] = logger.error.mock.calls[0];
    expect(fields.errorLocation).toMatch(/security\.test\.js:\d+:\d+$/);
    expect(JSON.stringify(fields)).not.toContain('ABCDE1234F');
  });

  it('performs a bcrypt comparison even when the email is unknown', async () => {
    const passwordHasher = { compare: vi.fn(async () => false), hash: vi.fn() };
    const service = createAuthService({
      userModel: { findOne: () => ({ select: async () => null }) },
      passwordHasher,
    });
    await expect(service.login({ email: 'nobody@example.test', password: 'whatever-password' }, jwtSecret))
      .rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(passwordHasher.compare).toHaveBeenCalledOnce();
    expect(passwordHasher.compare.mock.calls[0][1]).toMatch(/^\$2[aby]\$12\$/);
  });
});
