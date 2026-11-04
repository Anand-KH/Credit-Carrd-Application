import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/auth/auth.guards';
import { LoginPage } from './features/auth/login/login.page';
import { RegisterPage } from './features/auth/register/register.page';
import { DashboardPage } from './features/dashboard/dashboard.page';
import { ForbiddenPage } from './features/forbidden/forbidden.page';
import { ApplicationFormPage } from './features/applications/application-form/application-form.page';
import { ApplicationListPage } from './features/applications/application-list/application-list.page';
import { ApprovalDashboardPage } from './features/approvals/approval-dashboard.page';
import { ApprovalDetailsPage } from './features/approvals/approval-details.page';
import { ApplicationTrackingPage } from './features/applications/application-tracking.page';
import { DispatchQueuePage } from './features/dispatch/dispatch-queue.page';
import { AdminDashboardPage } from './features/admin/admin-dashboard.page';
import { AuditHistoryPage } from './features/admin/audit-history.page';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: 'login', component: LoginPage, canActivate: [guestGuard] },
  { path: 'register', component: RegisterPage, canActivate: [guestGuard] },
  {
    path: 'dashboard',
    component: DashboardPage,
    canActivate: [authGuard],
  },
  {
    path: 'applications',
    component: ApplicationListPage,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['APPLICANT'] },
  },
  {
    path: 'applications/new',
    component: ApplicationFormPage,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['APPLICANT'] },
  },
  {
    path: 'applications/:applicationNumber/status',
    component: ApplicationTrackingPage,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['APPLICANT'] },
  },
  {
    path: 'staff',
    component: DashboardPage,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['APPROVER', 'ADMIN', 'DISPATCH_OFFICER'] },
  },
  {
    path: 'approvals',
    component: ApprovalDashboardPage,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['APPROVER', 'ADMIN'] },
  },
  {
    path: 'approvals/:applicationNumber',
    component: ApprovalDetailsPage,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['APPROVER', 'ADMIN'] },
  },
  {
    path: 'dispatch',
    component: DispatchQueuePage,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['DISPATCH_OFFICER', 'ADMIN'] },
  },
  {
    path: 'admin',
    component: AdminDashboardPage,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN'] },
  },
  {
    path: 'admin/audit',
    component: AuditHistoryPage,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN'] },
  },
  { path: 'forbidden', component: ForbiddenPage },
  { path: '**', redirectTo: 'dashboard' },
];
