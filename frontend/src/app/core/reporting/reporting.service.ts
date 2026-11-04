import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../auth/api-url';
import { ApplicationCounts, ApplicationReportPage, AuditPage } from './reporting.models';

@Injectable({ providedIn: 'root' })
export class ReportingService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  counts(): Observable<{ counts: ApplicationCounts }> {
    return this.http.get<{ counts: ApplicationCounts }>(`${this.apiBaseUrl}/reports/application-counts`);
  }

  applications(query: { page: number; limit: number; status?: string; search?: string; dateFrom?: string; dateTo?: string }): Observable<ApplicationReportPage> {
    let params = new HttpParams().set('page', query.page).set('limit', query.limit);
    for (const [key, value] of Object.entries(query)) {
      if (key !== 'page' && key !== 'limit' && value) params = params.set(key, value);
    }
    return this.http.get<ApplicationReportPage>(`${this.apiBaseUrl}/reports/applications`, { params });
  }

  audits(query: { page: number; limit: number; action?: string; targetResource?: string }): Observable<AuditPage> {
    let params = new HttpParams().set('page', query.page).set('limit', query.limit);
    for (const [key, value] of Object.entries(query)) {
      if (key !== 'page' && key !== 'limit' && value) params = params.set(key, value);
    }
    return this.http.get<AuditPage>(`${this.apiBaseUrl}/reports/audit-logs`, { params });
  }
}
