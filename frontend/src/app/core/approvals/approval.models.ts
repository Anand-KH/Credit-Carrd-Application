import { ApplicationStatus } from '../applications/application.models';

export interface EligibilityResult {
  ageQualified?: boolean;
  scoreQualified?: boolean;
  manualReviewRequired?: boolean;
  unusualCreditLimitAmount?: boolean;
  creditLimitDecision?: number | null;
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
