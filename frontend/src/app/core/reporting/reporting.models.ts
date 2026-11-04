import { ApplicationStatus } from '../applications/application.models';

export interface ApplicationReport {
  applicationNumber: string;
  applicationDate: string;
  status: ApplicationStatus;
  income: number;
  creditScoreResult?: number;
  creditDecision?: string | null;
  dispatchStatus?: 'pending' | 'in_transit' | 'delivered' | 'failed' | null;
}

export interface ApplicationCounts {
  submitted: number;
  under_review: number;
  approved: number;
  rejected: number;
  manual_review: number;
  dispatched: number;
}

export interface ApplicationReportPage {
  items: ApplicationReport[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AuditEntry {
  actor: string;
  action: string;
  targetResource: string;
  timestamp: string;
  status: string | null;
}

export interface AuditPage {
  items: AuditEntry[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
