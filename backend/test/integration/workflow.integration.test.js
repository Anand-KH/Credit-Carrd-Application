import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import {
  Applicant,
  Application,
  ApplicationStatusHistory,
  AuditLog,
  CardDispatch,
  User,
} from '../../src/models/index.js';
import { createApplicationService } from '../../src/services/application.service.js';
import { createApprovalService } from '../../src/services/approval.service.js';
import { createDispatchService } from '../../src/services/dispatch.service.js';
import { createEligibilityService } from '../../src/services/eligibility.service.js';
import { createReportingService } from '../../src/services/reporting.service.js';

const models = [User, Applicant, Application, ApplicationStatusHistory, AuditLog, CardDispatch];
let replSet;

function fixedScore(score) {
  return { getCreditScore: async () => ({ score, provider: 'mock' }) };
}

function applicationService(score = 850) {
  return createApplicationService({
    eligibilityService: createEligibilityService({ creditScoreProvider: fixedScore(score) }),
  });
}

function applicantDetails(overrides = {}) {
  return {
    dateOfBirth: new Date('1990-01-01T00:00:00.000Z'),
    gender: 'other',
    phone: '+91 98765 43210',
    address: {
      line1: '1 Test Street',
      line2: '',
      city: 'Bengaluru',
      state: 'KA',
      postalCode: '560001',
      country: 'India',
    },
    annualIncome: 250000,
    employmentType: 'salaried',
    panLast4: 'AB12',
    ...overrides,
  };
}

async function createUser(role, email) {
  return User.create({
    name: `${role} user`,
    email,
    passwordHash: `$2b$12$${'a'.repeat(53)}`,
    role,
  });
}

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(replSet.getUri());
  // Transactions cannot create collections implicitly on every server version,
  // so create them (and their indexes) up front.
  for (const model of models) {
    await model.createCollection();
    await model.syncIndexes();
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  await replSet?.stop();
});

beforeEach(async () => {
  await Promise.all(models.map((model) => model.deleteMany({})));
});

describe('workflow against a real MongoDB replica set', () => {
  it('runs submit → approve → dispatch inside real transactions', async () => {
    const applicant = await createUser('APPLICANT', 'applicant@example.test');
    const approver = await createUser('APPROVER', 'approver@example.test');
    const officer = await createUser('DISPATCH_OFFICER', 'dispatch@example.test');

    const submitted = await applicationService().submit(applicant._id.toString(), applicantDetails());
    expect(submitted.status).toBe('submitted');

    const approved = await createApprovalService().decide(
      submitted.applicationNumber,
      { userId: approver._id.toString(), role: 'APPROVER' },
      { decision: 'approved', reason: 'Integration approval.' },
    );
    expect(approved.status).toBe('approved');

    const dispatchService = createDispatchService();
    const queue = await dispatchService.list({ page: 1, limit: 10, skip: 0, status: 'pending' });
    expect(queue.items).toEqual([expect.objectContaining({
      applicationNumber: submitted.applicationNumber,
      dispatchStatus: 'pending',
      dispatchReference: '',
    })]);

    await dispatchService.update(
      { userId: officer._id.toString() },
      { applicationNumber: submitted.applicationNumber, dispatchStatus: 'pending' },
    );
    await dispatchService.update(
      { userId: officer._id.toString() },
      { applicationNumber: submitted.applicationNumber, dispatchStatus: 'in_transit' },
    );
    const inTransit = await dispatchService.list({ page: 1, limit: 10, skip: 0, status: 'in_transit' });
    expect(inTransit.total).toBe(1);
    expect(inTransit.items[0].dispatchReference).toMatch(/^DSP-/);

    const history = await ApplicationStatusHistory.find().sort({ timestamp: 1 }).lean();
    expect(history.map((entry) => entry.newStatus)).toEqual(['submitted', 'approved', 'dispatched', 'dispatched']);
    expect(await AuditLog.countDocuments()).toBe(3);

    const counts = await createReportingService().statusCounts();
    expect(counts).toMatchObject({ dispatched: 1, pending_admin_approval: 0 });
  });

  it('blocks reapplying after a dispatched card and while an application is open', async () => {
    const applicant = await createUser('APPLICANT', 'repeat@example.test');
    const userId = applicant._id.toString();
    const first = await applicationService().submit(userId, applicantDetails());

    await expect(applicationService().submit(userId, applicantDetails()))
      .rejects.toMatchObject({ code: 'APPLICATION_IN_PROGRESS' });

    await Application.updateOne({ applicationNumber: first.applicationNumber }, { status: 'dispatched' });
    await expect(applicationService().submit(userId, applicantDetails()))
      .rejects.toMatchObject({ code: 'SIX_MONTH_RESTRICTION' });
  });

  it('rolls back the whole submission when a step inside the transaction fails', async () => {
    const applicant = await createUser('APPLICANT', 'rollback@example.test');
    const failing = createApplicationService({
      eligibilityService: createEligibilityService({ creditScoreProvider: fixedScore(850) }),
      statusHistoryModel: {
        create: async () => { throw new Error('history write failed'); },
      },
    });

    await expect(failing.submit(applicant._id.toString(), applicantDetails()))
      .rejects.toThrow('history write failed');
    expect(await Application.countDocuments()).toBe(0);
    expect(await Applicant.countDocuments()).toBe(0);
  });

  it('enforces unique indexes at the database level', async () => {
    await createUser('APPLICANT', 'dupe@example.test');
    await expect(createUser('APPLICANT', 'dupe@example.test'))
      .rejects.toMatchObject({ code: 11000 });
  });

  it('requires confirmation before approving a flagged credit limit', async () => {
    const applicant = await createUser('APPLICANT', 'flagged@example.test');
    const approver = await createUser('APPROVER', 'approver2@example.test');
    const submitted = await applicationService().submit(
      applicant._id.toString(),
      applicantDetails({ annualIncome: 400000 }),
    );
    const actor = { userId: approver._id.toString(), role: 'APPROVER' };

    await expect(createApprovalService().decide(submitted.applicationNumber, actor, {
      decision: 'approved',
      reason: 'No confirmation given.',
    })).rejects.toMatchObject({ code: 'CREDIT_LIMIT_CONFIRMATION_REQUIRED' });

    await expect(createApprovalService().decide(submitted.applicationNumber, actor, {
      decision: 'approved',
      reason: 'Limit confirmed.',
      confirmCreditLimit: true,
    })).resolves.toMatchObject({ status: 'approved' });
  });
});
