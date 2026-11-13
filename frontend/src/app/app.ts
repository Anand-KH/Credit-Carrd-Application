import { Component, computed, inject } from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { UserRole } from './core/auth/auth.models';

interface NavigationItem {
  label: string;
  path: string;
  icon: string;
}

@Component({
  selector: 'app-root',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatSidenavModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  readonly navigation = computed<NavigationItem[]>(() => {
    const role = this.authService.currentUser()?.role;
    return this.navigationForRole(role);
  });
  /** Persistent sidebar at 960px and wider; an overlay drawer below that. */
  private readonly breakpoints = inject(BreakpointObserver);
  // Seed with the current match so the first render already uses the right
  // sidenav mode; otherwise the content margin is computed for 'over' mode.
  readonly isDesktop = toSignal(
    this.breakpoints.observe('(min-width: 960px)').pipe(map((state) => state.matches)),
    { initialValue: this.breakpoints.isMatched('(min-width: 960px)') },
  );
  readonly initials = computed(() => {
    const name = this.authService.currentUser()?.name ?? '';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
  });
  readonly roleLabel = computed(() => {
    switch (this.authService.currentUser()?.role) {
      case 'APPLICANT': return 'Applicant';
      case 'APPROVER': return 'Approver';
      case 'ADMIN': return 'Administrator';
      case 'DISPATCH_OFFICER': return 'Dispatch officer';
      default: return '';
    }
  });
  readonly homeRoute = computed(() => (
    this.authService.currentUser()?.role === 'ADMIN' ? '/admin' : '/dashboard'
  ));

  private navigationForRole(role: UserRole | undefined): NavigationItem[] {
    switch (role) {
      case 'APPLICANT':
        return [
          { label: 'Dashboard', path: '/dashboard', icon: 'space_dashboard' },
          { label: 'My applications', path: '/applications', icon: 'description' },
          { label: 'New application', path: '/applications/new', icon: 'add_circle' },
        ];
      case 'APPROVER':
        return [
          { label: 'Dashboard', path: '/dashboard', icon: 'space_dashboard' },
          { label: 'Approval queue', path: '/approvals', icon: 'fact_check' },
        ];
      case 'ADMIN':
        return [
          { label: 'Reports', path: '/admin', icon: 'insights' },
          { label: 'Approval oversight', path: '/approvals', icon: 'admin_panel_settings' },
          { label: 'Dispatch oversight', path: '/dispatch', icon: 'local_shipping' },
          { label: 'Audit history', path: '/admin/audit', icon: 'history' },
        ];
      case 'DISPATCH_OFFICER':
        return [
          { label: 'Dashboard', path: '/dashboard', icon: 'space_dashboard' },
          { label: 'Dispatch queue', path: '/dispatch', icon: 'local_shipping' },
        ];
      default:
        return [];
    }
  }

  closeOnMobile(sidenav: MatSidenav): void {
    if (!this.isDesktop()) {
      void sidenav.close();
    }
  }

  logout(): void {
    this.authService.logout();
    void this.router.navigateByUrl('/login');
  }

  isSignedIn(): boolean {
    return this.authService.isAuthenticated();
  }
}
