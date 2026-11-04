import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { createApprovalService } from '../src/services/approval.service.js';
import { createApprovalRouter } from '../src/routes/approval.routes.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import { requestContext } from '../src/middleware/request-context.js';

const jwtSecret = 'test-secret-with-more-than-thirty-two-characters';
const approverId = new mongoose.Types.ObjectId();
const applicantId = new mongoose.Types.ObjectId();

function tokenFor(role) {
  return jwt.sign({}, jwtSecret, {
    subject: role === 'APPROVER' ? approverId.toString() : applicantId.toString(),
    issuer: 'credit-card-application-api',
    audience: 'credit-card-application-client',
    expiresIn: '10m',
  });
}

function createFixture({ status = 'submitted', score = 801, manualReviewRequired = false } = {}) {
  return {
    _id: new mongoose.Types.ObjectId(),
    applicationNumber: 'APP-TEST-1',
    applicant: applicantId,
    applicationDate: new Date('2026-10-28T10:00:00.000Z'),
    status,
    income: 250000,
    creditScoreResult: score,
    creditLimitDecision: manualReviewRequired ? null : 75000,
    creditDecision: null,
    eligibilityResult: { manualReviewRequired },
  };
}

describe('approval workflow', () => {
  const servers = [];
  let current;
  const histories = [];
  const audits = [];
  const session = {
    withTransaction: async (callback) => callback(),
    endSession: vi.fn(),
  };
  const applicationModel = {
    findOne: () => ({
      session: async () => current,
    }),
    findOneAndUpdate: async (_filter, update) => {
      if (!current || !['submitted', 'under_review', 'manual_review'].includes(current.status)) {
        return null;
      }
      current = {
        ...current,
        ...update.$set,
      };
      return current;
    },
    find: () => ({
      select: () => ({
        sort: () => ({
          skip: () => ({
            limit: () => ({
              lean: async () => (current ? [current] : []),
            }),
          }),
        }),
      }),
    }),
    countDocuments: async () => (current ? 1 : 0),
  };
  const userModel = {
    findById: async (id) => ({
      _id: id,
      role: id.toString() === approverId.toString() ? 'APPROVER' : 'APPLICANT',
      accountStatus: 'ACTIVE',
    }),
  };

  function service() {
    return createApprovalService({
      applicationModel,
      statusHistoryModel: { create: async (records) => histories.push(records[0]) },
      auditLogModel: { create: async (records) => audits.push(records[0]) },
      sessionFactory: async () => session,
    });
  }

  afterEach(async () => {
    for (const server of servers) {
      if (server.listening) {
        await new Promise((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
      }
    }
    servers.length = 0;
    current = undefined;
    histories.length = 0;
    audits.length = 0;
  });

  async function startServer() {
    const app = express();
    app.use(requestContext);
    app.use(express.json());
    app.use('/api/approvals', createApprovalRouter({
      config: { jwtSecret },
      approvalService: service(),
      userModel,
    }));
    app.use(errorHandler({ error: vi.fn() }));
    const server = app.listen(0);
    servers.push(server);
    await new Promise((resolve) => server.once('listening', resolve));
    const address = server.address();
    return `http://127.0.0.1:${address.port}`;
  }

  it('prevents applicants from accessing approval APIs', async () => {
    current = createFixture();
    const baseUrl = await startServer();
    const response = await fetch(`${baseUrl}/api/approvals`, {
      headers: { Authorization: `Bearer ${tokenFor('APPLICANT')}` },
    });
    expect(response.status).toBe(403);
  });

  it('lists reviewable applications with filters and pagination', async () => {
    current = createFixture({ status: 'manual_review', manualReviewRequired: true });
    const baseUrl = await startServer();
    const response = await fetch(`${baseUrl}/api/approvals?status=manual_review&search=TEST&page=1&limit=5`, {
      headers: { Authorization: `Bearer ${tokenFor('APPROVER')}` },
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      page: 1,
      limit: 5,
      total: 1,
      items: [{ applicationNumber: 'APP-TEST-1', status: 'manual_review' }],
    });
  });

  it('approves a qualifying application and records history and audit data', async () => {
    current = createFixture();
    const baseUrl = await startServer();
    const response = await fetch(`${baseUrl}/api/approvals/APP-TEST-1/decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenFor('APPROVER')}`,
      },
      body: JSON.stringify({ decision: 'approved', reason: 'Score and eligibility reviewed.' }),
    });
    expect(response.status).toBe(200);
    expect(current.status).toBe('approved');
    expect(histories[0]).toMatchObject({
      previousStatus: 'submitted',
      newStatus: 'approved',
      actor: approverId.toString(),
    });
    expect(audits[0]).toMatchObject({
      action: 'application_approved',
      targetResource: 'APP-TEST-1',
    });
  });

  it('rejects invalid status transitions and duplicate decisions', async () => {
    current = createFixture({ status: 'approved' });
    const baseUrl = await startServer();
    const response = await fetch(`${baseUrl}/api/approvals/APP-TEST-1/decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenFor('APPROVER')}`,
      },
      body: JSON.stringify({ decision: 'rejected', reason: 'Duplicate decision attempt.' }),
    });
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'INVALID_STATUS_TRANSITION' },
    });
  });

  it('enforces score 800 and manual review rules', async () => {
    current = createFixture({ score: 800 });
    await expect(service().decide('APP-TEST-1', {
      userId: approverId.toString(),
    }, { decision: 'approved', reason: 'Attempt to approve score 800.' }))
      .rejects.toMatchObject({ code: 'CREDIT_SCORE_NOT_ELIGIBLE' });

    current = createFixture({ status: 'manual_review', manualReviewRequired: true });
    await expect(service().decide('APP-TEST-1', {
      userId: approverId.toString(),
    }, { decision: 'approved', reason: 'Attempt to skip manual limit review.' }))
      .rejects.toMatchObject({ code: 'MANUAL_REVIEW_REQUIRED' });
  });

  it('requires a decision reason', async () => {
    const baseUrl = await startServer();
    current = createFixture();
    const response = await fetch(`${baseUrl}/api/approvals/APP-TEST-1/decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenFor('APPROVER')}`,
      },
      body: JSON.stringify({ decision: 'rejected', reason: 'no' }),
    });
    expect(response.status).toBe(400);
  });
});
