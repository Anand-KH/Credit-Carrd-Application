import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { createApplicationRouter } from '../src/routes/application.routes.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import { requestContext } from '../src/middleware/request-context.js';
import { createApplicationService } from '../src/services/application.service.js';

const jwtSecret = 'test-secret-with-more-than-thirty-two-characters';
const userId = new mongoose.Types.ObjectId();

function tokenFor(id = userId) {
  return jwt.sign({}, jwtSecret, {
    subject: id.toString(),
    issuer: 'credit-card-application-api',
    audience: 'credit-card-application-client',
    expiresIn: '10m',
  });
}

function validDetails() {
  return {
    dateOfBirth: '1995-04-11',
    gender: 'male',
    phone: '+91 98765 43210',
    address: {
      line1: '12 Green Avenue',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560001',
      country: 'India',
    },
    annualIncome: 250000,
    employmentType: 'salaried',
    panLast4: 'AB12',
  };
}

describe('applicant application workflow', () => {
  let server;
  const applicant = { _id: new mongoose.Types.ObjectId() };
  const applications = [];
  const histories = [];
  const applicantsByUser = new Map();
  const session = {
    withTransaction: async (callback) => callback(),
    endSession: vi.fn(),
  };
  const applicationService = createApplicationService({
    eligibilityService: {
      evaluate: async ({ applicantId }) => ({
        status: 'submitted',
        creditScoreResult: 801,
        creditLimitDecision: 75000,
        eligibilityResult: {
          ageQualified: true,
          scoreQualifies: true,
          eligibleForApprovalConsideration: true,
          scoreThreshold: 800,
          creditLimitRule: 'income_200001_to_300000',
          creditLimitReview: 'not_required',
          manualReviewRequired: false,
          unusualAmountFlag: false,
          provider: 'mock',
          evaluatedAt: new Date(),
        },
        historyReason: 'Application submitted for explicit approver decision after eligibility evaluation.',
        applicantId,
      }),
    },
    sessionFactory: async () => session,
    applicantModel: {
      findOneAndUpdate: async (query, update) => {
        expect(query.user.toString()).toBe(userId.toString());
        expect(update.$set).not.toHaveProperty('applicant');
        const record = { ...applicant, user: query.user, ...update.$set };
        applicantsByUser.set(query.user.toString(), record);
        return record;
      },
      findOne: () => ({
        select: () => ({
          lean: async () => applicantsByUser.get(userId.toString()) ?? null,
        }),
      }),
    },
    applicationModel: {
      create: async (records) => {
        const record = {
          ...records[0],
          _id: new mongoose.Types.ObjectId(),
          createdAt: new Date(),
        };
        applications.push(record);
        return [record];
      },
      find: () => ({
        select: () => ({
          sort: () => ({
            skip: () => ({
              limit: async () => applications,
            }),
          }),
        }),
      }),
      countDocuments: async () => applications.length,
    },
    statusHistoryModel: {
      create: async (records) => {
        histories.push(records[0]);
        return records;
      },
    },
  });
  const userModel = {
    findById: async (id) => ({
      _id: id,
      accountStatus: 'ACTIVE',
      role: 'APPLICANT',
    }),
  };

  afterEach(async () => {
    if (server?.listening) {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
    applications.length = 0;
    histories.length = 0;
    applicantsByUser.clear();
  });

  async function startServer() {
    const app = express();
    app.use(requestContext);
    app.use(express.json());
    app.use('/api/applications', createApplicationRouter({
      config: { jwtSecret },
      applicationService,
      userModel,
    }));
    app.use(errorHandler({ error: vi.fn() }));
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const address = server.address();
    return `http://127.0.0.1:${address.port}`;
  }

  it('submits a valid application and creates its initial history entry', async () => {
    const baseUrl = await startServer();
    const response = await fetch(`${baseUrl}/api/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenFor()}`,
      },
      body: JSON.stringify(validDetails()),
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.application.applicationNumber).toMatch(/^APP-/);
    expect(body.application.status).toBe('submitted');
    expect(applications[0].applicant.toString()).toBe(applicant._id.toString());
    expect(histories).toHaveLength(1);
    expect(histories[0]).toMatchObject({
      previousStatus: null,
      newStatus: 'submitted',
      actor: userId.toString(),
    });
  });

  it('rejects invalid input and protected fields', async () => {
    const baseUrl = await startServer();
    const response = await fetch(`${baseUrl}/api/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenFor()}`,
      },
      body: JSON.stringify({
        ...validDetails(),
        dateOfBirth: '2015-01-01',
        status: 'approved',
        creditScoreResult: 900,
        applicant: new mongoose.Types.ObjectId().toString(),
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'VALIDATION_ERROR' },
    });
    expect(applications).toHaveLength(0);
  });

  it('rejects unauthenticated access', async () => {
    const baseUrl = await startServer();
    const response = await fetch(`${baseUrl}/api/applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validDetails()),
    });

    expect(response.status).toBe(401);
  });

  it('does not allow a caller to submit for another user', async () => {
    const baseUrl = await startServer();
    const otherUserId = new mongoose.Types.ObjectId();
    const response = await fetch(`${baseUrl}/api/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenFor(otherUserId)}`,
      },
      body: JSON.stringify({
        ...validDetails(),
        user: userId.toString(),
        applicant: applicant._id.toString(),
      }),
    });

    expect(response.status).toBe(400);
    expect(applications).toHaveLength(0);
  });

  it('lists only the authenticated applicant records with pagination metadata', async () => {
    const baseUrl = await startServer();
    const response = await fetch(`${baseUrl}/api/applications/me?page=2&limit=1`, {
      headers: { Authorization: `Bearer ${tokenFor()}` },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      page: 2,
      limit: 1,
      total: 0,
      totalPages: 0,
      items: [],
    });
  });
});
