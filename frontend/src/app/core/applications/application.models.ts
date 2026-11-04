export type ApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'manual_review'
  | 'pending_admin_approval'
  | 'dispatched';

export interface ApplicantAddress {
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface ApplicationSubmission {
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  phone: string;
  address: ApplicantAddress;
  annualIncome: number;
  employmentType: 'salaried' | 'self_employed' | 'business_owner' | 'retired';
  panLast4: string;
}

export interface ApplicantApplication {
  applicationNumber: string;
  applicationDate: string;
  status: ApplicationStatus;
  income: number;
  createdAt: string;
}

export interface ApplicationPage {
  items: ApplicantApplication[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApplicationStatusTimelineEntry {
  status: string;
  previousStatus: string | null;
  timestamp: string;
  reason: string;
}

export interface ApplicationTracking {
  applicationNumber: string;
  applicationDate: string;
  status: ApplicationStatus;
  timeline: ApplicationStatusTimelineEntry[];
}
