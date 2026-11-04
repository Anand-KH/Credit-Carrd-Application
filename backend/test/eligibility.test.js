import { describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { createMockCreditScoreProvider } from '../src/services/credit-score.provider.js';
import { calculateAge, subtractMonths } from '../src/utils/date.js';
import { createEligibilityService } from '../src/services/eligibility.service.js';
import { createApplicationService } from '../src/services/application.service.js';

const applicantId = new mongoose.Types.ObjectId();
const fixedNow = new Date('2026-10-28T12:00:00.000Z');

function applicationModelWith(recentApplication = null) {
  return {
    findOne: (query) => ({
      sort: () => ({
        session: async () => (
          recentApplication
          && recentApplication.applicationDate >= query.applicationDate.$gte
          && query.status.$in.includes(recentApplication.status)
            ? recentApplication
            : null
        ),
      }),
    }),
  };
}

function evaluateWith({ score = 801, income = 200000, dateOfBirth = '2000-10-28' } = {}) {
  const service = createEligibilityService({
    applicationModel: applicationModelWith(),
    creditScoreProvider: createMockCreditScoreProvider({ defaultScore: score }),
    now: () => fixedNow,
  });
  return service.evaluate({
    applicantId,
    dateOfBirth: new Date(`${dateOfBirth}T00:00:00.000Z`),
    annualIncome: income,
  });
}

describe('eligibility and credit-decision services', () => {
  it('calculates boundary ages using calendar dates', () => {
    expect(calculateAge('2008-10-29', fixedNow)).toBe(17);
    expect(calculateAge('2008-10-28', fixedNow)).toBe(18);
    expect(calculateAge('2008-10-27', fixedNow)).toBe(18);
  });

  it('uses the exact six-month cutoff', async () => {
    const cutoff = subtractMonths(fixedNow, 6);
    const service = createEligibilityService({
      applicationModel: applicationModelWith({
        applicationDate: new Date(cutoff.getTime() + 1),
        status: 'approved',
      }),
      creditScoreProvider: createMockCreditScoreProvider(),
      now: () => fixedNow,
    });

    await expect(service.evaluate({
      applicantId,
      dateOfBirth: new Date('1990-01-01T00:00:00.000Z'),
      annualIncome: 200000,
    })).rejects.toMatchObject({ code: 'SIX_MONTH_RESTRICTION' });
  });

  it('allows an application before the six-month cutoff', async () => {
    const cutoff = subtractMonths(fixedNow, 6);
    const result = await createEligibilityService({
      applicationModel: applicationModelWith({
        applicationDate: new Date(cutoff.getTime() - 1),
        status: 'rejected',
      }),
      creditScoreProvider: createMockCreditScoreProvider({ defaultScore: 801 }),
      now: () => fixedNow,
    }).evaluate({
      applicantId,
      dateOfBirth: new Date('1990-01-01T00:00:00.000Z'),
      annualIncome: 200000,
    });

    expect(result.status).toBe('submitted');
  });

  it('handles score boundaries without automatically approving', async () => {
    const score800 = await evaluateWith({ score: 800 });
    const score801 = await evaluateWith({ score: 801 });

    expect(score800.status).toBe('rejected');
    expect(score800.eligibilityResult.scoreQualifies).toBe(false);
    expect(score800.creditDecision).toBeUndefined();
    expect(score801.status).toBe('submitted');
    expect(score801.eligibilityResult.scoreQualifies).toBe(true);
  });

  it.each([
    [200000, 50000, 'income_lte_200000'],
    [200001, 75000, 'income_200001_to_300000'],
    [300000, 75000, 'income_200001_to_300000'],
    [300001, 1000000, 'income_300001_to_500000'],
    [500000, 1000000, 'income_300001_to_500000'],
  ])('applies income boundary %i', async (income, expectedLimit, expectedRule) => {
    const result = await evaluateWith({ income });
    expect(result.creditLimitDecision).toBe(expectedLimit);
    expect(result.eligibilityResult.creditLimitRule).toBe(expectedRule);
  });

  it('flags the unusual configured limit for confirmation', async () => {
    const result = await createEligibilityService({
      applicationModel: applicationModelWith(),
      creditScoreProvider: createMockCreditScoreProvider({ defaultScore: 801 }),
      creditLimit300kTo500k: 900000,
      now: () => fixedNow,
    }).evaluate({
      applicantId,
      dateOfBirth: new Date('1990-01-01T00:00:00.000Z'),
      annualIncome: 300001,
    });

    expect(result.creditLimitDecision).toBe(900000);
    expect(result.eligibilityResult.unusualAmountFlag).toBe(true);
    expect(result.eligibilityResult.creditLimitReview).toBe('confirmation_required');
  });

  it('routes income above 500000 to manual credit-limit review', async () => {
    const result = await evaluateWith({ income: 500001 });
    expect(result.status).toBe('manual_review');
    expect(result.creditLimitDecision).toBeNull();
    expect(result.eligibilityResult.manualReviewRequired).toBe(true);
    expect(result.eligibilityResult.creditLimitReview).toBe('manual_review_required');
  });

  it('rejects underage applicants', async () => {
    await expect(evaluateWith({ dateOfBirth: '2008-10-29' }))
      .rejects.toMatchObject({ code: 'APPLICANT_NOT_OLD_ENOUGH' });
    await expect(evaluateWith({ dateOfBirth: '2008-10-28' }))
      .rejects.toMatchObject({ code: 'APPLICANT_NOT_OLD_ENOUGH' });
    await expect(evaluateWith({ dateOfBirth: '2008-10-27' }))
      .rejects.toMatchObject({ code: 'APPLICANT_NOT_OLD_ENOUGH' });
  });

  it('uses deterministic mock provider scenarios', async () => {
    const provider = createMockCreditScoreProvider({
      scores: { low: 800, passing: 801 },
    });
    await expect(provider.getCreditScore({ scenario: 'low' })).resolves.toMatchObject({
      score: 800,
      provider: 'mock',
      scenario: 'low',
    });
    await expect(provider.getCreditScore({ scenario: 'passing' })).resolves.toMatchObject({
      score: 801,
      provider: 'mock',
      scenario: 'passing',
    });
  });

  it('serializes concurrent submissions so a rejected decision blocks the next one', async () => {
    const applications = [];
    let transactionQueue = Promise.resolve();
    const service = createApplicationService({
      sessionFactory: async () => ({
        withTransaction(callback) {
          const transaction = transactionQueue.then(callback);
          transactionQueue = transaction.catch(() => undefined);
          return transaction;
        },
        endSession: async () => {},
      }),
      applicantModel: {
        findOneAndUpdate: async () => ({
          _id: applicantId,
        }),
      },
      applicationModel: {
        findOne: () => ({
          sort: () => ({
            session: async () => applications.find((application) => (
              ['approved', 'rejected'].includes(application.status)
            )) ?? null,
          }),
        }),
        create: async (records) => {
          applications.push(records[0]);
          return [{
            ...records[0],
            _id: new mongoose.Types.ObjectId(),
            createdAt: fixedNow,
          }];
        },
      },
      statusHistoryModel: {
        create: async () => {},
      },
      eligibilityService: createEligibilityService({
        applicationModel: {
          findOne: () => ({
            sort: () => ({
              session: async () => applications.find((application) => (
                ['approved', 'rejected'].includes(application.status)
              )) ?? null,
            }),
          }),
        },
        creditScoreProvider: createMockCreditScoreProvider({ defaultScore: 800 }),
        now: () => fixedNow,
      }),
    });

    const submissions = await Promise.allSettled([
      service.submit('user-1', {
        dateOfBirth: new Date('1990-01-01T00:00:00.000Z'),
        annualIncome: 200000,
      }),
      service.submit('user-1', {
        dateOfBirth: new Date('1990-01-01T00:00:00.000Z'),
        annualIncome: 200000,
      }),
    ]);

    expect(submissions.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(submissions.filter(({ status }) => status === 'rejected')).toHaveLength(1);
    expect(submissions.find(({ status }) => status === 'rejected').reason.code)
      .toBe('SIX_MONTH_RESTRICTION');
  });
});
