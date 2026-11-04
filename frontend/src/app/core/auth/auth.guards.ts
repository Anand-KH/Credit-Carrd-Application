import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { UserRole } from './auth.models';

export const authGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url },
  });
};

export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree([
    authService.currentUser()?.role === 'ADMIN' ? '/admin' : '/dashboard',
  ]);
};

export const roleGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const user = authService.currentUser();
  const routeRoles: unknown = route.data['roles'];

  if (!user) {
    return router.createUrlTree(['/login']);
  }

  if (
    !Array.isArray(routeRoles)
    || !routeRoles.every((role): role is UserRole => (
      role === 'APPLICANT'
      || role === 'APPROVER'
      || role === 'ADMIN'
      || role === 'DISPATCH_OFFICER'
    ))
  ) {
    return router.createUrlTree(['/forbidden']);
  }

  return routeRoles.includes(user.role)
    ? true
    : router.createUrlTree(['/forbidden']);
};
