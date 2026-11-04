import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../auth/api-url';
import {
  ApplicantApplication,
  ApplicationPage,
  ApplicationSubmission,
  ApplicationTracking,
} from './application.models';

@Injectable({ providedIn: 'root' })
export class ApplicationService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  submit(details: ApplicationSubmission): Observable<{ application: ApplicantApplication }> {
    return this.http.post<{ application: ApplicantApplication }>(
      `${this.apiBaseUrl}/applications`,
      details,
    );
  }

  listMine(page = 1, limit = 10): Observable<ApplicationPage> {
    const params = new HttpParams()
      .set('page', page)
      .set('limit', limit);
    return this.http.get<ApplicationPage>(`${this.apiBaseUrl}/applications/me`, { params });
  }

  track(applicationNumber: string): Observable<{ application: ApplicationTracking }> {
    return this.http.get<{ application: ApplicationTracking }>(
      `${this.apiBaseUrl}/applications/${encodeURIComponent(applicationNumber)}/status`,
    );
  }
}
