import mongoose from 'mongoose';
import { Applicant } from '../models/applicant.model.js';
import { Application } from '../models/application.model.js';
import { ApplicationStatusHistory } from '../models/application-status-history.model.js';
import { createEligibilityService } from './eligibility.service.js';
import { HttpError } from '../utils/http-error.js';

function generateApplicationNumber() {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return `APP-${suffix.toUpperCase()}`;
}

function responseApplication(application) {
  return {
    applicationNumber: application.applicationNumber,
    applicationDate: application.applicationDate,
    status: application.status,
    income: application.income,
    createdAt: application.createdAt,
  };
}

function responseTracking(application, history) {
  return {
    applicationNumber: application.applicationNumber,
    applicationDate: application.applicationDate,
    status: application.status,
    timeline: history.map((entry) => ({
      status: entry.newStatus,
      previousStatus: entry.previousStatus,
      timestamp: entry.timestamp,
      reason: entry.reason,
    })),
  };
}

export function createApplicationService({
  applicantModel = Applicant,
  applicationModel = Application,
  statusHistoryModel = ApplicationStatusHistory,
  sessionFactory = () => mongoose.startSession(),
  eligibilityService = createEligibilityService({
    applicationModel,
    creditScoreProvider: { getCreditScore: async () => ({ score: 801, provider: 'mock' }) },
  }),
} = {}) {
  return {
    async submit(userId, details) {
      const session = await sessionFactory();
      try {
        let result;
        await session.withTransaction(async () => {
          const applicant = await applicantModel.findOneAndUpdate(
            { user: userId },
            {
              $set: details,
              $setOnInsert: { user: userId },
              $inc: { eligibilityLockVersion: 1 },
            },
            { new: true, upsert: true, runValidators: true, session },
          );
          const eligibility = await eligibilityService.evaluate({
            applicantId: applicant._id,
            dateOfBirth: details.dateOfBirth,
            annualIncome: details.annualIncome,
            session,
          });
          let application;
          for (let attempt = 0; attempt < 3; attempt += 1) {
            try {
              application = await applicationModel.create([{
                applicationNumber: generateApplicationNumber(),
                applicant: applicant._id,
                income: details.annualIncome,
                applicationDate: new Date(),
                status: eligibility.status,
                creditScoreResult: eligibility.creditScoreResult,
                creditLimitDecision: eligibility.creditLimitDecision,
                eligibilityResult: eligibility.eligibilityResult,
              }], { session });
              break;
            } catch (error) {
              if (error.code !== 11000 || attempt === 2) {
                throw error;
              }
            }
          }

          const savedApplication = application[0];
          await statusHistoryModel.create([{
            application: savedApplication._id,
            previousStatus: null,
            newStatus: eligibility.status,
            actor: userId,
            reason: eligibility.historyReason,
          }], { session });
          result = responseApplication(savedApplication);
        });
        return result;
      } finally {
        await session.endSession();
      }
    },

    async listForUser(userId, { page, limit, skip }) {
      const applicant = await applicantModel.findOne({ user: userId }).select('_id').lean();
      if (!applicant) {
        return { items: [], page, limit, total: 0, totalPages: 0 };
      }

      const [items, total] = await Promise.all([
        applicationModel.find({ applicant: applicant._id })
          .select('applicationNumber applicationDate status income createdAt')
          .sort({ applicationDate: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        applicationModel.countDocuments({ applicant: applicant._id }),
      ]);
      return {
        items: items.map(responseApplication),
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      };
    },

    async getTrackingForUser(userId, applicationNumber) {
      if (!/^APP-[A-Z0-9-]+$/.test(applicationNumber.toUpperCase())) {
        throw new HttpError(400, 'INVALID_APPLICATION_NUMBER', 'Application number is invalid.');
      }
      const applicant = await applicantModel.findOne({ user: userId }).select('_id').lean();
      if (!applicant) {
        throw new HttpError(404, 'APPLICATION_NOT_FOUND', 'Application was not found.');
      }
      const application = await applicationModel.findOne({
        applicant: applicant._id,
        applicationNumber: applicationNumber.toUpperCase(),
      }).select('applicationNumber applicationDate status').lean();
      if (!application) {
        throw new HttpError(404, 'APPLICATION_NOT_FOUND', 'Application was not found.');
      }
      const history = await statusHistoryModel.find({ application: application._id })
        .select('previousStatus newStatus timestamp reason')
        .sort({ timestamp: 1 })
        .lean();
      return responseTracking(application, history);
    },
  };
}
