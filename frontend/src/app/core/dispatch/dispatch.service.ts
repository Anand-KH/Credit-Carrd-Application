import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../auth/api-url';
import { CardDispatch, DispatchPage, DispatchStatus } from './dispatch.models';

@Injectable({ providedIn: 'root' })
export class DispatchService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  list(page = 1, limit = 10, status = ''): Observable<DispatchPage> {
    let params = new HttpParams().set('page', page).set('limit', limit);
    if (status) params = params.set('status', status);
    return this.http.get<DispatchPage>(`${this.apiBaseUrl}/card-dispatch`, { params });
  }

  update(applicationNumber: string, dispatchStatus: DispatchStatus, dispatchReference?: string): Observable<{ dispatch: CardDispatch }> {
    return this.http.patch<{ dispatch: CardDispatch }>(`${this.apiBaseUrl}/card-dispatch`, {
      applicationNumber,
      dispatchStatus,
      ...(dispatchReference ? { dispatchReference } : {}),
    });
  }
}
