import mongoose from 'mongoose';

const applicationStatuses = ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'manual_review', 'pending_admin_approval', 'dispatched'];
const creditDecisionLevels = ['approved', 'rejected', 'manual_review'];

const applicationSchema = new mongoose.Schema({
  applicationNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
    index: true,
  },
  applicant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Applicant',
    required: true,
    index: true,
  },
  income: {
    type: Number,
    required: true,
    min: 0,
  },
  applicationDate: {
    type: Date,
    required: true,
    default: Date.now,
    index: true,
  },
  status: {
    type: String,
    enum: applicationStatuses,
    required: true,
    default: 'submitted',
    index: true,
  },
  creditScoreResult: {
    type: Number,
    min: 300,
    max: 900,
    default: null,
  },
  creditLimitDecision: {
    type: Number,
    min: 0,
    default: null,
  },
  creditDecision: {
    type: String,
    enum: creditDecisionLevels,
    default: null,
  },
  eligibilityResult: {
    ageQualified: { type: Boolean, required: true, default: false },
    scoreQualifies: { type: Boolean, required: true, default: false },
    eligibleForApprovalConsideration: { type: Boolean, required: true, default: false },
    scoreThreshold: { type: Number, required: true, default: 800 },
    creditLimitRule: { type: String, required: true, default: '' },
    creditLimitReview: {
      type: String,
      enum: ['not_required', 'confirmation_required', 'manual_review_required'],
      required: true,
      default: 'not_required',
    },
    manualReviewRequired: { type: Boolean, required: true, default: false },
    unusualAmountFlag: { type: Boolean, required: true, default: false },
    provider: { type: String, required: true, default: 'mock' },
    evaluatedAt: { type: Date, required: true, default: Date.now },
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 2000,
    default: '',
  },
  submittedAt: {
    type: Date,
    default: Date.now,
  },
  reviewedAt: {
    type: Date,
    default: null,
  },
  approvedAt: {
    type: Date,
    default: null,
  },
  rejectedAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

applicationSchema.index({ applicant: 1, status: 1, applicationDate: 1 });
applicationSchema.index({ applicant: 1, applicationDate: -1 });
applicationSchema.index({ status: 1, applicationDate: 1 });
applicationSchema.index({ applicationNumber: 1, applicationDate: -1 });

applicationSchema.statics.findRecentApplicationsForEligibility = function findRecentApplicationsForEligibility(applicantId, cutoffDate) {
  return this.find({
    applicant: applicantId,
    status: { $in: ['approved', 'rejected'] },
    applicationDate: { $gte: cutoffDate },
  }).sort({ applicationDate: -1 });
};

export const Application = mongoose.model('Application', applicationSchema);

export default Application;
