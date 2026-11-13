import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../auth/api-url';
import { ApprovalApplication, ApprovalPage } from './approval.models';

@Injectable({ providedIn: 'root' })
export class ApprovalService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  list(page = 1, limit = 10, status = '', search = ''): Observable<ApprovalPage> {
    let params = new HttpParams().set('page', page).set('limit', limit);
    if (status) params = params.set('status', status);
    if (search) params = params.set('search', search);
    return this.http.get<ApprovalPage>(`${this.apiBaseUrl}/approvals`, { params });
  }

  get(applicationNumber: string): Observable<{ application: ApprovalApplication }> {
    return this.http.get<{ application: ApprovalApplication }>(
      `${this.apiBaseUrl}/approvals/${encodeURIComponent(applicationNumber)}`,
    );
  }

  decide(
    applicationNumber: string,
    decision: 'approved' | 'rejected',
    reason: string,
    confirmCreditLimit = false,
  ): Observable<{ application: ApprovalApplication }> {
    return this.http.post<{ application: ApprovalApplication }>(
      `${this.apiBaseUrl}/approvals/${encodeURIComponent(applicationNumber)}/decision`,
      { decision, reason, ...(confirmCreditLimit ? { confirmCreditLimit: true } : {}) },
    );
  }

  submitManualReview(applicationNumber: string, creditLimit: number, reason: string): Observable<{ application: ApprovalApplication }> {
    return this.http.post<{ application: ApprovalApplication }>(
      `${this.apiBaseUrl}/approvals/${encodeURIComponent(applicationNumber)}/manual-review`,
      { creditLimit, reason },
    );
  }
}
