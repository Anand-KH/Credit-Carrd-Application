import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/auth/auth.guards';

// Pages are lazy-loaded so each role only downloads the screens it can use.
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: 'login', loadComponent: () => import('./features/auth/login/login.page').then((m) => m.LoginPage), canActivate: [guestGuard] },
  { path: 'register', loadComponent: () => import('./features/auth/register/register.page').then((m) => m.RegisterPage), canActivate: [guestGuard] },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage),
    canActivate: [authGuard],
  },
  {
    path: 'applications',
    loadComponent: () => import('./features/applications/application-list/application-list.page').then((m) => m.ApplicationListPage),
    canActivate: [authGuard, roleGuard],
    data: { roles: ['APPLICANT'] },
  },
  {
    path: 'applications/new',
    loadComponent: () => import('./features/applications/application-form/application-form.page').then((m) => m.ApplicationFormPage),
    canActivate: [authGuard, roleGuard],
    data: { roles: ['APPLICANT'] },
  },
  {
    path: 'applications/:applicationNumber/status',
    loadComponent: () => import('./features/applications/application-tracking.page').then((m) => m.ApplicationTrackingPage),
    canActivate: [authGuard, roleGuard],
    data: { roles: ['APPLICANT'] },
  },
  {
    path: 'staff',
    loadComponent: () => import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage),
    canActivate: [authGuard, roleGuard],
    data: { roles: ['APPROVER', 'ADMIN', 'DISPATCH_OFFICER'] },
  },
  {
    path: 'approvals',
    loadComponent: () => import('./features/approvals/approval-dashboard.page').then((m) => m.ApprovalDashboardPage),
    canActivate: [authGuard, roleGuard],
    data: { roles: ['APPROVER', 'ADMIN'] },
  },
  {
    path: 'approvals/:applicationNumber',
    loadComponent: () => import('./features/approvals/approval-details.page').then((m) => m.ApprovalDetailsPage),
    canActivate: [authGuard, roleGuard],
    data: { roles: ['APPROVER', 'ADMIN'] },
  },
  {
    path: 'dispatch',
    loadComponent: () => import('./features/dispatch/dispatch-queue.page').then((m) => m.DispatchQueuePage),
    canActivate: [authGuard, roleGuard],
    data: { roles: ['DISPATCH_OFFICER', 'ADMIN'] },
  },
  {
    path: 'admin',
    loadComponent: () => import('./features/admin/admin-dashboard.page').then((m) => m.AdminDashboardPage),
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN'] },
  },
  {
    path: 'admin/audit',
    loadComponent: () => import('./features/admin/audit-history.page').then((m) => m.AuditHistoryPage),
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN'] },
  },
  { path: 'forbidden', loadComponent: () => import('./features/forbidden/forbidden.page').then((m) => m.ForbiddenPage) },
  { path: '**', redirectTo: 'dashboard' },
];
