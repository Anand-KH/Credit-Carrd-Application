import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
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
    MatListModule,
    MatMenuModule,
    MatSidenavModule,
    MatToolbarModule,
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
          { label: 'Dashboard', path: '/admin', icon: 'space_dashboard' },
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

  logout(): void {
    this.authService.logout();
    void this.router.navigateByUrl('/login');
  }

  isSignedIn(): boolean {
    return this.authService.isAuthenticated();
  }
}
