import { ApplicationStatus } from '../applications/application.models';

// Mirrors the backend Application.eligibilityResult sub-document.
export interface EligibilityResult {
  ageQualified?: boolean;
  scoreQualifies?: boolean;
  eligibleForApprovalConsideration?: boolean;
  scoreThreshold?: number;
  creditLimitRule?: string;
  creditLimitReview?: 'not_required' | 'confirmation_required' | 'manual_review_required';
  manualReviewRequired?: boolean;
  unusualAmountFlag?: boolean;
}

export interface ApprovalApplication {
  applicationNumber: string;
  applicationDate: string;
  status: ApplicationStatus;
  income: number;
  creditScoreResult?: number;
  creditLimitDecision?: number | null;
  creditDecision?: 'approved' | 'rejected' | null;
  eligibilityResult?: EligibilityResult;
  reviewedAt?: string;
}

export interface ApprovalPage {
  items: ApprovalApplication[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
