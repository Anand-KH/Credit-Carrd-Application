import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { createReportingRouter } from '../src/routes/reporting.routes.js';
import { createReportingService } from '../src/services/reporting.service.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import { requestContext } from '../src/middleware/request-context.js';

const jwtSecret = 'test-secret-with-more-than-thirty-two-characters';
const adminId = new mongoose.Types.ObjectId();
const applicantId = new mongoose.Types.ObjectId();

function tokenFor(id) {
  return jwt.sign({}, jwtSecret, {
    subject: id.toString(),
    issuer: 'credit-card-application-api',
    audience: 'credit-card-application-client',
    expiresIn: '10m',
  });
}

function chain(items) {
  return {
    select: () => ({
      sort: () => ({
        skip: () => ({
          limit: () => ({ lean: async () => items }),
        }),
      }),
    }),
  };
}

describe('administrator reporting', () => {
  let server;
  const applications = [
    {
      applicationNumber: 'APP-1001',
      applicationDate: new Date('2026-10-01'),
      status: 'approved',
      income: 250000,
      creditScoreResult: 820,
      creditDecision: 'approved',
    },
  ];
  const audits = [{
    actor: adminId.toString(),
    action: 'application_approved',
    targetResource: 'APP-1001',
    timestamp: new Date('2026-10-02'),
    metadata: { decision: 'approved' },
  }];
  const applicationModel = {
    aggregate: vi.fn(async () => [
      { _id: 'approved', count: 1 },
      { _id: 'submitted', count: 2 },
    ]),
    find: () => chain(applications),
    countDocuments: async () => applications.length,
  };
  const auditLogModel = {
    find: () => chain(audits),
    countDocuments: async () => audits.length,
  };
  const reportingService = createReportingService({ applicationModel, auditLogModel });
  const userModel = {
    findById: async (id) => ({
      _id: id,
      role: id.toString() === adminId.toString() ? 'ADMIN' : 'APPLICANT',
      accountStatus: 'ACTIVE',
    }),
  };

  afterEach(async () => {
    if (server?.listening) {
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  });

  async function startServer() {
    const app = express();
    app.use(requestContext);
    app.use(express.json());
    app.use('/api/reports', createReportingRouter({
      config: { jwtSecret },
      reportingService,
      userModel,
    }));
    app.use(errorHandler({ error: vi.fn() }));
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    return `http://127.0.0.1:${server.address().port}`;
  }

  it('blocks non-administrators from reporting endpoints', async () => {
    const baseUrl = await startServer();
    const response = await fetch(`${baseUrl}/api/reports/application-counts`, {
      headers: { Authorization: `Bearer ${tokenFor(applicantId)}` },
    });
    expect(response.status).toBe(403);
  });

  it('returns aggregation-backed status counts for administrators', async () => {
    const baseUrl = await startServer();
    const response = await fetch(`${baseUrl}/api/reports/application-counts`, {
      headers: { Authorization: `Bearer ${tokenFor(adminId)}` },
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      counts: { submitted: 2, approved: 1, rejected: 0, manual_review: 0, dispatched: 0, under_review: 0 },
    });
    expect(applicationModel.aggregate).toHaveBeenCalledOnce();
  });

  it('filters and paginates application reports', async () => {
    const baseUrl = await startServer();
    const response = await fetch(`${baseUrl}/api/reports/applications?status=approved&search=APP-10&dateFrom=2026-10-01&dateTo=2026-10-31&page=1&limit=5`, {
      headers: { Authorization: `Bearer ${tokenFor(adminId)}` },
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      page: 1,
      limit: 5,
      total: 1,
      items: [{ applicationNumber: 'APP-1001', status: 'approved' }],
    });
  });

  it('returns a paginated, read-only audit log view', async () => {
    const baseUrl = await startServer();
    const response = await fetch(`${baseUrl}/api/reports/audit-logs?action=application_approved&page=1&limit=10`, {
      headers: { Authorization: `Bearer ${tokenFor(adminId)}` },
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      total: 1,
      items: [{ action: 'application_approved', targetResource: 'APP-1001' }],
    });
  });

  it('rejects invalid report filters', async () => {
    const baseUrl = await startServer();
    const response = await fetch(`${baseUrl}/api/reports/applications?dateFrom=not-a-date`, {
      headers: { Authorization: `Bearer ${tokenFor(adminId)}` },
    });
    expect(response.status).toBe(400);
  });
});
