import { afterEach, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcrypt';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { authenticate } from '../src/middleware/authenticate.js';
import { authorizeRoles } from '../src/middleware/authorize-roles.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import { requestContext } from '../src/middleware/request-context.js';

const jwtSecret = 'test-secret-with-more-than-thirty-two-characters';
const testConfig = {
  allowedOrigins: ['http://localhost:4200'],
  jwtSecret,
};

describe('authentication API', () => {
  const servers = [];
  const users = new Map();
  const userModel = {
    async create(values) {
      if (users.has(values.email)) {
        const duplicateError = new Error('Duplicate key');
        duplicateError.code = 11000;
        throw duplicateError;
      }

      const user = { ...values, _id: new mongoose.Types.ObjectId() };
      users.set(user.email, user);
      return user;
    },
    findOne({ email }) {
      return { select: async () => users.get(email) ?? null };
    },
    async findById(id) {
      return [...users.values()].find((user) => user._id.toString() === id) ?? null;
    },
  };
  const logger = { log: vi.fn(), info: vi.fn(), error: vi.fn() };

  afterEach(async () => {
    for (const server of servers) {
      if (server.listening) {
        await new Promise((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
      }
    }
    servers.length = 0;
    users.clear();
  });

  async function startServer(app = createApp({
    config: testConfig,
    logger,
    userModel,
  })) {
    const server = app.listen(0);
    servers.push(server);
    await new Promise((resolve) => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Expected the server to listen on a TCP port');
    }
    return `http://127.0.0.1:${address.port}`;
  }

  async function register(baseUrl, body = {
    name: 'Fictional Applicant',
    email: 'applicant@example.test',
    password: 'a-safe-test-password-2026',
  }) {
    return fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('registers applicants with a password hash and a signed access token', async () => {
    const baseUrl = await startServer();

    const response = await register(baseUrl);
    expect(response.status).toBe(201);
    const body = await response.json();

    expect(body.user).toMatchObject({
      name: 'Fictional Applicant',
      email: 'applicant@example.test',
      role: 'APPLICANT',
    });
    expect(body.accessToken).toBeTruthy();
    expect(body).not.toHaveProperty('passwordHash');
    expect(jwt.decode(body.accessToken)).not.toHaveProperty('role');
    expect(users.get('applicant@example.test').passwordHash).toMatch(/^\$2[aby]\$/);
    await expect(bcrypt.compare(
      'a-safe-test-password-2026',
      users.get('applicant@example.test').passwordHash,
    )).resolves.toBe(true);
  });

  it('rejects duplicate accounts and browser-supplied roles', async () => {
    const baseUrl = await startServer();
    await register(baseUrl);

    const duplicateResponse = await register(baseUrl);
    expect(duplicateResponse.status).toBe(409);
    await expect(duplicateResponse.json()).resolves.toMatchObject({
      error: { code: 'EMAIL_ALREADY_REGISTERED' },
    });

    const roleResponse = await register(baseUrl, {
      name: 'Privilege Attempt',
      email: 'role@example.test',
      password: 'a-safe-test-password-2026',
      role: 'ADMIN',
    });
    expect(roleResponse.status).toBe(400);
    await expect(roleResponse.json()).resolves.toMatchObject({
      error: { code: 'INVALID_REQUEST_BODY' },
    });
    expect(users.has('role@example.test')).toBe(false);
  });

  it('uses the same invalid-credentials response and blocks inactive users', async () => {
    const baseUrl = await startServer();
    await register(baseUrl);

    const wrongPassword = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'applicant@example.test',
        password: 'incorrect-password',
      }),
    });
    expect(wrongPassword.status).toBe(401);
    const invalidCredentials = await wrongPassword.json();
    expect(invalidCredentials).toMatchObject({
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Email or password is incorrect.',
      },
    });

    const unknownAccount = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'unknown@example.test',
        password: 'a-safe-test-password-2026',
      }),
    });
    expect(unknownAccount.status).toBe(401);
    const unknownCredentials = await unknownAccount.json();
    expect(unknownCredentials.error).toMatchObject({
      code: invalidCredentials.error.code,
      message: invalidCredentials.error.message,
    });

    const inactivePasswordHash = await bcrypt.hash('a-safe-test-password-2026', 12);
    const inactiveUser = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Inactive Applicant',
      email: 'inactive@example.test',
      passwordHash: inactivePasswordHash,
      role: 'APPLICANT',
      accountStatus: 'INACTIVE',
    };
    users.set(inactiveUser.email, inactiveUser);

    const inactiveResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: inactiveUser.email,
        password: 'a-safe-test-password-2026',
      }),
    });
    expect(inactiveResponse.status).toBe(403);
    await expect(inactiveResponse.json()).resolves.toMatchObject({
      error: { code: 'ACCOUNT_INACTIVE' },
    });
    // Five real cost-12 bcrypt operations; allow headroom on slow or busy machines.
  }, 15_000);

  it('returns the authenticated user and denies forbidden roles', async () => {
    const baseUrl = await startServer();
    const registration = await register(baseUrl);
    const { accessToken, user } = await registration.json();

    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'applicant@example.test',
        password: 'a-safe-test-password-2026',
      }),
    });
    expect(login.status).toBe(200);

    const currentUser = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(currentUser.status).toBe(200);
    await expect(currentUser.json()).resolves.toEqual({ user });

    const restrictedApp = express();
    restrictedApp.use(requestContext);
    restrictedApp.get(
      '/restricted',
      authenticate({ jwtSecret, userModel }),
      authorizeRoles('ADMIN', 'APPROVER', 'DISPATCH_OFFICER'),
      (_request, response) => response.sendStatus(204),
    );
    restrictedApp.use(errorHandler({ error: vi.fn() }));
    const restrictedUrl = await startServer(restrictedApp);

    const forbiddenResponse = await fetch(`${restrictedUrl}/restricted`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(forbiddenResponse.status).toBe(403);
    await expect(forbiddenResponse.json()).resolves.toMatchObject({
      error: { code: 'FORBIDDEN' },
    });

    const storedUser = users.get('applicant@example.test');
    for (const role of ['APPROVER', 'ADMIN', 'DISPATCH_OFFICER']) {
      storedUser.role = role;
      const staffToken = jwt.sign({}, jwtSecret, {
        subject: storedUser._id.toString(),
        issuer: 'credit-card-application-api',
        audience: 'credit-card-application-client',
        expiresIn: '1m',
        algorithm: 'HS256',
      });
      const allowedResponse = await fetch(`${restrictedUrl}/restricted`, {
        headers: { Authorization: `Bearer ${staffToken}` },
      });
      expect(allowedResponse.status).toBe(204);
    }
  });

  it('rejects expired bearer tokens safely', async () => {
    const user = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Fictional Applicant',
      email: 'applicant@example.test',
      role: 'APPLICANT',
      accountStatus: 'ACTIVE',
    };
    users.set(user.email, user);
    const expiredToken = jwt.sign({}, jwtSecret, {
      subject: user._id.toString(),
      issuer: 'credit-card-application-api',
      audience: 'credit-card-application-client',
      expiresIn: '-1s',
      algorithm: 'HS256',
    });
    const app = express();
    app.use(requestContext);
    app.get(
      '/protected',
      authenticate({ jwtSecret, userModel }),
      (_request, response) => response.sendStatus(204),
    );
    app.use(errorHandler({ error: vi.fn() }));
    const baseUrl = await startServer(app);

    const response = await fetch(`${baseUrl}/protected`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'TOKEN_EXPIRED' },
    });
  });
});
