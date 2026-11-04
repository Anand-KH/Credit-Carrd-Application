import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../shared/ui/toast.service';

export const httpErrorInterceptor: HttpInterceptorFn = (_request, next) => {
  const toastService = inject(ToastService);

  return next(_request).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        toastService.showError(error.error?.error?.message ?? 'An unexpected error occurred.');
      }
      return throwError(() => error);
    }),
  );
};
