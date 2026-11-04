import { describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { Application, Applicant, AuditLog, ApplicationStatusHistory, CardDispatch, User } from '../src/models/index.js';

const temporaryUserData = {
  name: 'Aarav Sharma',
  email: 'aarav.sharma@example.com',
  passwordHash: `$2b$12$${'a'.repeat(53)}`,
  role: 'APPLICANT',
  accountStatus: 'ACTIVE',
};

describe('database models', () => {
  it('stores a valid user record without plain text password', () => {
    const record = new User(temporaryUserData);
    expect(record.name).toBe('Aarav Sharma');
    expect(record.passwordHash).toBe(temporaryUserData.passwordHash);
    expect(record.passwordHash).not.toContain('Aarav');
    expect(record.email).toBe('aarav.sharma@example.com');
    expect(record.role).toBe('APPLICANT');
  });

  it('rejects a plaintext password in the password hash field', async () => {
    const record = new User({
      ...temporaryUserData,
      passwordHash: 'not-a-password-hash',
    });

    await expect(record.validate()).rejects.toMatchObject({
      errors: { passwordHash: expect.anything() },
    });
  });

  it('creates a linked applicant profile with indexable identity data', () => {
    new User(temporaryUserData);
    const applicant = new Applicant({
      user: new mongoose.Types.ObjectId(),
      dateOfBirth: new Date('1995-04-11T00:00:00.000Z'),
      gender: 'male',
      phone: '+91 98765 43210',
      address: {
        line1: '12 Green Avenue',
        line2: 'Block B',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560001',
        country: 'India',
      },
      annualIncome: 250000,
      employmentType: 'salaried',
      panLast4: 'AB12',
    });

    expect(applicant.user).toBeDefined();
    expect(applicant.panLast4).toBe('AB12');
    expect(applicant.address.country).toBe('India');
  });

  it('creates an application with a unique application number and status history reference', () => {
    const applicant = new Applicant({
      user: new mongoose.Types.ObjectId(),
      dateOfBirth: new Date('1993-03-14T00:00:00.000Z'),
      gender: 'female',
      phone: '+91 99887 66554',
      address: {
        line1: '45 River Road',
        city: 'Hyderabad',
        state: 'Telangana',
        postalCode: '500001',
        country: 'India',
      },
      annualIncome: 420000,
      employmentType: 'self_employed',
      panLast4: 'CD34',
    });

    const application = new Application({
      applicationNumber: 'APP-1001',
      applicant: applicant._id,
      income: 420000,
      status: 'submitted',
      creditScoreResult: 820,
      creditLimitDecision: 100000,
      creditDecision: 'approved',
    });

    const history = new ApplicationStatusHistory({
      application: application._id,
      previousStatus: 'draft',
      newStatus: 'submitted',
      actor: 'applicant',
      reason: 'Application submitted',
    });

    expect(application.applicationNumber).toBe('APP-1001');
    expect(history.newStatus).toBe('submitted');
    expect(history.application.toString()).toBe(application._id.toString());
  });

  it('creates a dispatch and an audit log with structured metadata', () => {
    const application = new Application({
      applicationNumber: 'APP-1002',
      applicant: new mongoose.Types.ObjectId(),
      income: 700000,
      status: 'approved',
      creditScoreResult: 850,
      creditLimitDecision: 500000,
      creditDecision: 'approved',
    });

    const dispatch = new CardDispatch({
      application: application._id,
      dispatchReference: 'DISP-9001',
      dispatchStatus: 'pending',
    });

    const audit = new AuditLog({
      actor: 'administrator',
      action: 'card_dispatched',
      targetResource: 'CardDispatch',
      metadata: {
        applicationNumber: application.applicationNumber,
        dispatchReference: dispatch.dispatchReference,
        safeNote: 'mock dispatch record',
      },
    });

    expect(dispatch.dispatchReference).toBe('DISP-9001');
    expect(audit.metadata.safeNote).toBe('mock dispatch record');
  });

  it('removes sensitive fields from audit metadata', async () => {
    const audit = new AuditLog({
      actor: 'administrator',
      action: 'test',
      targetResource: 'Application',
      metadata: { accessToken: 'secret' },
    });
    expect(audit.metadata).not.toHaveProperty('accessToken');
  });

  it('enforces unique application numbers and required status fields', () => {
    const first = new Application({
      applicationNumber: 'APP-1003',
      applicant: new mongoose.Types.ObjectId(),
      income: 180000,
      status: 'submitted',
    });

    const second = new Application({
      applicationNumber: 'APP-1003',
      applicant: new mongoose.Types.ObjectId(),
      income: 180000,
      status: 'rejected',
    });

    expect(first.applicationNumber).toBe('APP-1003');
    expect(second.applicationNumber).toBe('APP-1003');
    expect(first.status).toBe('submitted');
    expect(second.status).toBe('rejected');
  });
});
