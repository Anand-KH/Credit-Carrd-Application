import { Application } from '../models/application.model.js';
import { subtractMonths, isOlderThanAge } from '../utils/date.js';
import { HttpError } from '../utils/http-error.js';

const SCORE_THRESHOLD = 800;
const SIX_MONTHS = 6;
// Any application that is still open, or that reached a final decision within
// the restriction window, blocks a new submission. `dispatched` applications
// were approved, so they count too.
const BLOCKING_STATUSES = [
  'submitted',
  'under_review',
  'manual_review',
  'pending_admin_approval',
  'approved',
  'dispatched',
  'rejected',
];
const OPEN_STATUSES = ['submitted', 'under_review', 'manual_review', 'pending_admin_approval'];

function calculateCreditLimit(income, configuredLimit) {
  if (income <= 200000) {
    return {
      amount: 50000,
      review: 'not_required',
      rule: 'income_lte_200000',
    };
  }
  if (income <= 300000) {
    return {
      amount: 75000,
      review: 'not_required',
      rule: 'income_200001_to_300000',
    };
  }
  if (income <= 500000) {
    return {
      amount: configuredLimit,
      review: 'confirmation_required',
      rule: 'income_300001_to_500000',
      unusualAmountFlag: true,
    };
  }
  return {
    amount: null,
    review: 'manual_review_required',
    rule: 'income_above_500000',
    manualReviewRequired: true,
  };
}

export function createEligibilityService({
  applicationModel = Application,
  creditScoreProvider,
  creditLimit300kTo500k = 1000000,
  now = () => new Date(),
} = {}) {
  if (!creditScoreProvider) {
    throw new Error('A credit score provider is required');
  }
  if (!Number.isFinite(creditLimit300kTo500k) || creditLimit300kTo500k < 0) {
    throw new Error('Configured credit limit must be a non-negative number');
  }

  return {
    async evaluate({ applicantId, dateOfBirth, annualIncome, scoreScenario, session }) {
      const evaluationDate = now();
      if (!isOlderThanAge(dateOfBirth, 18, evaluationDate)) {
        throw new HttpError(
          400,
          'APPLICANT_NOT_OLD_ENOUGH',
          'Applicant must be older than 18 years.',
        );
      }

      const cutoffDate = subtractMonths(evaluationDate, SIX_MONTHS);
      const recentApplication = await applicationModel.findOne({
        applicant: applicantId,
        status: { $in: BLOCKING_STATUSES },
        $or: [
          { status: { $in: OPEN_STATUSES } },
          { applicationDate: { $gte: cutoffDate } },
        ],
      }).sort({ applicationDate: -1 }).session(session);
      if (recentApplication && OPEN_STATUSES.includes(recentApplication.status)) {
        throw new HttpError(
          409,
          'APPLICATION_IN_PROGRESS',
          'An application is already in progress for this applicant.',
        );
      }
      if (recentApplication) {
        throw new HttpError(
          409,
          'SIX_MONTH_RESTRICTION',
          'An approved, dispatched, or rejected application exists within the previous six months.',
        );
      }

      const scoreResult = await creditScoreProvider.getCreditScore({
        applicantId: applicantId.toString(),
        scenario: scoreScenario,
      });
      const creditLimit = calculateCreditLimit(annualIncome, creditLimit300kTo500k);
      const scoreQualifies = scoreResult.score > SCORE_THRESHOLD;
      const eligibleForApprovalConsideration = scoreQualifies && !creditLimit.manualReviewRequired;
      const status = scoreQualifies
        ? creditLimit.manualReviewRequired ? 'manual_review' : 'submitted'
        : 'rejected';

      return {
        status,
        creditScoreResult: scoreResult.score,
        creditLimitDecision: creditLimit.amount,
        eligibilityResult: {
          ageQualified: true,
          scoreQualifies,
          eligibleForApprovalConsideration,
          scoreThreshold: SCORE_THRESHOLD,
          creditLimitRule: creditLimit.rule,
          creditLimitReview: creditLimit.review,
          manualReviewRequired: creditLimit.manualReviewRequired ?? false,
          unusualAmountFlag: creditLimit.unusualAmountFlag ?? false,
          provider: scoreResult.provider,
          evaluatedAt: evaluationDate,
        },
        historyReason: scoreQualifies
          ? 'Application submitted for explicit approver decision after eligibility evaluation.'
          : 'Application rejected because credit score does not exceed 800.',
      };
    },
  };
}

export { calculateCreditLimit, SCORE_THRESHOLD, BLOCKING_STATUSES };
