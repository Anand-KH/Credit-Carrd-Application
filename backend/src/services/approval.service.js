import mongoose from 'mongoose';
import { Application } from '../models/application.model.js';
import { ApplicationStatusHistory } from '../models/application-status-history.model.js';
import { AuditLog } from '../models/audit-log.model.js';
import { HttpError } from '../utils/http-error.js';

const reviewableStatuses = ['submitted', 'under_review', 'manual_review'];

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

function buildFilter({ status, search }) {
  const filter = { status: status ?? { $in: reviewableStatuses } };
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

    async list({ page, limit, skip, status, search }) {
      const filter = buildFilter({ status, search });
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

    async decide(applicationNumber, actor, { decision, reason }) {
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
          if (!reviewableStatuses.includes(current.status)) {
            throw new HttpError(409, 'INVALID_STATUS_TRANSITION', 'Application is not in a reviewable status.');
          }
          if (decision === 'approved' && current.creditScoreResult <= 800) {
            throw new HttpError(409, 'CREDIT_SCORE_NOT_ELIGIBLE', 'Applications require a credit score greater than 800.');
          }
          if (decision === 'approved' && current.eligibilityResult?.manualReviewRequired) {
            throw new HttpError(409, 'MANUAL_REVIEW_REQUIRED', 'Manual credit-limit review is required before approval.');
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
            { new: true, runValidators: true, session },
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
