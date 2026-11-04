import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import { createLogger } from '../src/utils/logger.js';

describe('backend API foundation', () => {
  let server;

  afterEach(async () => {
    if (server?.listening) {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
    server = undefined;
  });

  async function startServer(app = createApp({
    config: {
      jwtSecret: 'test-secret-with-more-than-thirty-two-characters',
      allowedOrigins: ['http://localhost:4200'],
      creditLimit300kTo500k: 1000000,
    },
  })) {
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const address = server.address();
    expect(address).not.toBeNull();
    expect(typeof address).not.toBe('string');

    if (!address || typeof address === 'string') {
      throw new Error('Expected the server to listen on a TCP port');
    }

    return `http://127.0.0.1:${address.port}`;
  }

  it('reports application health and an ISO timestamp', async () => {
    const baseUrl = await startServer();

    const response = await fetch(`${baseUrl}/api/health`);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
    expect(response.headers.get('x-request-id')).toBeTruthy();
  });

  it('returns the standard error shape for unknown routes', async () => {
    const baseUrl = await startServer();

    const response = await fetch(`${baseUrl}/api/unknown`);
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'NOT_FOUND',
        message: 'The requested resource was not found.',
      },
    });
  });

  it('converts malformed JSON into a client error response', async () => {
    const baseUrl = await startServer();

    const response = await fetch(`${baseUrl}/api/health`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid',
    });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'INVALID_JSON',
        message: 'Request body must contain valid JSON.',
      },
    });
  });

  it('rejects JSON request bodies that are not objects', async () => {
    const baseUrl = await startServer();

    const response = await fetch(`${baseUrl}/api/health`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '[]',
    });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'INVALID_REQUEST_BODY' },
    });
  });

  it('returns a sanitized standard response for unexpected errors', () => {
    const logger = { error: vi.fn() };
    const response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      headersSent: false,
    };

    errorHandler(logger)(
      new Error('sensitive applicant details'),
      { id: 'request-123' },
      response,
      vi.fn(),
    );

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred.',
        requestId: 'request-123',
      },
    });
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain('sensitive applicant details');
  });

  it('allows configured origins and rejects unconfigured origins', async () => {
    const baseUrl = await startServer();

    const allowedResponse = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: 'http://localhost:4200' },
    });
    expect(allowedResponse.headers.get('access-control-allow-origin'))
      .toBe('http://localhost:4200');

    const deniedResponse = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: 'https://untrusted.example' },
    });
    expect(deniedResponse.status).toBe(403);
    await expect(deniedResponse.json()).resolves.toMatchObject({
      error: { code: 'ORIGIN_NOT_ALLOWED' },
    });
  });

  it('omits sensitive fields from structured logs', () => {
    const output = { log: vi.fn() };
    const logger = createLogger(output);

    logger.info('test.event', {
      requestId: 'request-123',
      applicantName: 'Fictional Applicant',
      body: { pan: 'not-a-real-pan' },
    });

    expect(output.log).toHaveBeenCalledOnce();
    expect(output.log.mock.calls[0][0]).not.toContain('Fictional Applicant');
    expect(output.log.mock.calls[0][0]).not.toContain('not-a-real-pan');
  });
});
