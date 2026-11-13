import mongoose from 'mongoose';
import { Application } from '../models/application.model.js';
import { ApplicationStatusHistory } from '../models/application-status-history.model.js';
import { AuditLog } from '../models/audit-log.model.js';
import { HttpError } from '../utils/http-error.js';

const reviewableStatuses = ['submitted', 'under_review', 'manual_review', 'pending_admin_approval'];
const approverDecisionStatuses = ['submitted', 'under_review', 'manual_review'];

function safeApplication(application) {
  return {
    applicationNumber: application.applicationNumber,
    applicationDate: application.applicationDate,
    status: application.status,
    income: application.income,
    creditScoreResult: application.creditScoreResult,
    creditLimitDecision: application.creditLimitDecision,
    creditDecision: application.creditDecision,
    eligibilityResult: application.eligibilityResult,
    reviewedAt: application.reviewedAt,
  };
}

function buildFilter({ status, search, role }) {
  const allowedStatuses = role === 'ADMIN'
    ? ['pending_admin_approval']
    : approverDecisionStatuses;
  const filter = { status: status && allowedStatuses.includes(status) ? status : { $in: allowedStatuses } };
  if (search) {
    filter.applicationNumber = { $regex: search, $options: 'i' };
  }
  return filter;
}

export function createApprovalService({
  applicationModel = Application,
  statusHistoryModel = ApplicationStatusHistory,
  auditLogModel = AuditLog,
  sessionFactory = () => mongoose.startSession(),
  creditLimitRequiresConfirmation = true,
} = {}) {
  return {
    async get(applicationNumber) {
      const application = await applicationModel.findOne({
        applicationNumber: applicationNumber.toUpperCase(),
      }).lean();
      if (!application) {
        throw new HttpError(404, 'APPLICATION_NOT_FOUND', 'Application was not found.');
      }
      return safeApplication(application);
    },

    async list({ page, limit, skip, status, search }, actor = {}) {
      const filter = buildFilter({ status, search, role: actor.role });
      const [items, total] = await Promise.all([
        applicationModel.find(filter)
          .select('applicationNumber applicationDate status income creditScoreResult creditLimitDecision eligibilityResult')
          .sort({ applicationDate: 1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        applicationModel.countDocuments(filter),
      ]);
      return {
        items: items.map(safeApplication),
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      };
    },

    async submitManualReview(applicationNumber, actor, { creditLimit, reason }) {
      const session = await sessionFactory();
      try {
        let result;
        await session.withTransaction(async () => {
          const current = await applicationModel.findOne({ applicationNumber: applicationNumber.toUpperCase() }).session(session);
          if (!current || current.status !== 'manual_review') {
            throw new HttpError(409, 'INVALID_STATUS_TRANSITION', 'Application is not awaiting manual credit-limit review.');
          }
          const updated = await applicationModel.findOneAndUpdate(
            { _id: current._id, status: 'manual_review' },
            { $set: { status: 'pending_admin_approval', creditLimitDecision: creditLimit } },
            { returnDocument: 'after', runValidators: true, session },
          );
          if (!updated) throw new HttpError(409, 'DECISION_ALREADY_RECORDED', 'Manual review was already submitted.');
          await statusHistoryModel.create([{ application: updated._id, previousStatus: current.status, newStatus: updated.status, actor: actor.userId, timestamp: new Date(), reason }], { session });
          await auditLogModel.create([{ actor: actor.userId, action: 'application_manual_review_submitted', targetResource: updated.applicationNumber, timestamp: new Date(), metadata: { creditLimit, reason, previousStatus: current.status, newStatus: updated.status } }], { session });
          result = safeApplication(updated);
        });
        return result;
      } finally {
        await session.endSession();
      }
    },

    async decide(applicationNumber, actor, { decision, reason, confirmCreditLimit = false }) {
      const session = await sessionFactory();
      try {
        let result;
        await session.withTransaction(async () => {
          const current = await applicationModel.findOne({
            applicationNumber: applicationNumber.toUpperCase(),
          }).session(session);
          if (!current) {
            throw new HttpError(404, 'APPLICATION_NOT_FOUND', 'Application was not found.');
          }
          const isAdminManualDecision = actor.role === 'ADMIN' && current.status === 'pending_admin_approval';
          const isApproverDecision = actor.role === 'APPROVER'
            && approverDecisionStatuses.includes(current.status);
          if (!isAdminManualDecision && !isApproverDecision) {
            throw new HttpError(409, 'INVALID_STATUS_TRANSITION', 'Application is not in a reviewable status.');
          }
          if (decision === 'approved' && !(current.creditScoreResult > 800)) {
            throw new HttpError(409, 'CREDIT_SCORE_NOT_ELIGIBLE', 'Applications require a credit score greater than 800.');
          }
          if (decision === 'approved' && current.eligibilityResult?.manualReviewRequired && !isAdminManualDecision) {
            throw new HttpError(409, 'MANUAL_REVIEW_REQUIRED', 'Manual credit-limit review is required before approval.');
          }
          const needsLimitConfirmation = decision === 'approved'
            && creditLimitRequiresConfirmation
            && current.eligibilityResult?.creditLimitReview === 'confirmation_required';
          if (needsLimitConfirmation && confirmCreditLimit !== true) {
            throw new HttpError(
              409,
              'CREDIT_LIMIT_CONFIRMATION_REQUIRED',
              'This credit limit is flagged as unusual and must be explicitly confirmed before approval.',
            );
          }

          const nextStatus = decision;
          const updated = await applicationModel.findOneAndUpdate(
            {
              _id: current._id,
              status: { $in: reviewableStatuses },
            },
            {
              $set: {
                status: nextStatus,
                creditDecision: decision,
                reviewedAt: new Date(),
                ...(decision === 'approved' ? { approvedAt: new Date() } : { rejectedAt: new Date() }),
              },
            },
            { returnDocument: 'after', runValidators: true, session },
          );
          if (!updated) {
            throw new HttpError(409, 'DECISION_ALREADY_RECORDED', 'A decision was already recorded for this application.');
          }

          await statusHistoryModel.create([{
            application: updated._id,
            previousStatus: current.status,
            newStatus: nextStatus,
            actor: actor.userId,
            timestamp: new Date(),
            reason,
          }], { session });
          await auditLogModel.create([{
            actor: actor.userId,
            action: `application_${decision}`,
            targetResource: updated.applicationNumber,
            timestamp: new Date(),
            metadata: {
              decision,
              reason,
              previousStatus: current.status,
              newStatus: nextStatus,
              ...(needsLimitConfirmation ? { creditLimit: current.creditLimitDecision, creditLimitConfirmed: true } : {}),
            },
          }], { session });
          result = safeApplication(updated);
        });
        return result;
      } finally {
        await session.endSession();
      }
    },
  };
}
