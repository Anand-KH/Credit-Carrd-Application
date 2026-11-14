import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { API_BASE_URL } from './api-url';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const authService = inject(AuthService);
  const apiBaseUrl = inject(API_BASE_URL).replace(/\/+$/, '');
  const isApiRequest = request.url === apiBaseUrl
    || request.url.startsWith(`${apiBaseUrl}/`)
    || request.url.startsWith(`${apiBaseUrl}?`);
  const accessToken = isApiRequest ? authService.accessToken : null;
  const authenticatedRequest = accessToken
    ? request.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } })
    : request;

  return next(authenticatedRequest).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && accessToken) {
        authService.expireSession();
      }
      return throwError(() => error);
    }),
  );
};
