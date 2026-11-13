import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../shared/ui/toast.service';

/**
 * Pages show request errors inline, so the global toast is reserved for failures
 * no page can explain: the API being unreachable. 401s are handled by the auth
 * interceptor (redirect to sign-in). A request can opt in to a toast for any
 * error with `context: new HttpContext().set(SHOW_ERROR_TOAST, true)`.
 */
export const SHOW_ERROR_TOAST = new HttpContextToken<boolean>(() => false);

export const httpErrorInterceptor: HttpInterceptorFn = (request, next) => {
  const toastService = inject(ToastService);

  return next(request).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        if (error.status === 0) {
          toastService.showError('Unable to reach the server. Check your connection and try again.');
        } else if (request.context.get(SHOW_ERROR_TOAST) && error.status !== 401) {
          toastService.showError(error.error?.error?.message ?? 'An unexpected error occurred.');
        }
      }
      return throwError(() => error);
    }),
  );
};
