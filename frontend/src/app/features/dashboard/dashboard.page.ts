import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { DatePipe, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ApplicationService } from '../../core/applications/application.service';
import { ApplicantApplication } from '../../core/applications/application.models';
import { ApprovalService } from '../../core/approvals/approval.service';
import { ApprovalApplication } from '../../core/approvals/approval.models';
import { DispatchService } from '../../core/dispatch/dispatch.service';
import { CardDispatch } from '../../core/dispatch/dispatch.models';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ErrorMessageComponent } from '../../shared/ui/error-message.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator.component';
import { StatusChipComponent } from '../../shared/ui/status-chip.component';

@Component({
  selector: 'app-dashboard-page',
  imports: [
    DatePipe,
    DecimalPipe,
    NgTemplateOutlet,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    RouterLink,
    EmptyStateComponent,
    ErrorMessageComponent,
    LoadingIndicatorComponent,
    StatusChipComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
})
export class DashboardPage implements OnInit {
  readonly authService = inject(AuthService);
  private readonly applications = inject(ApplicationService);
  private readonly approvals = inject(ApprovalService);
  private readonly dispatches = inject(DispatchService);
  private readonly destroyRef = inject(DestroyRef);
  readonly applicantApplications = signal<ApplicantApplication[]>([]);
  readonly reviewQueue = signal<ApprovalApplication[]>([]);
  readonly dispatchQueue = signal<CardDispatch[]>([]);
  readonly totalApplications = signal(0);
  readonly totalReviewable = signal(0);
  readonly loading = signal(true);
  readonly errorMessage = signal('');

  ngOnInit(): void {
    const role = this.authService.currentUser()?.role;
    if (role === 'APPLICANT') this.loadApplicantDashboard();
    else if (role === 'APPROVER' || role === 'ADMIN') this.loadStaffDashboard();
    else if (role === 'DISPATCH_OFFICER') this.loadDispatchDashboard();
    else this.loading.set(false);
  }

  private loadDispatchDashboard(): void {
    this.dispatches.list(1, 5).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.dispatchQueue.set(result.items);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Unable to load the dispatch summary.');
        this.loading.set(false);
      },
    });
  }

  private loadApplicantDashboard(): void {
    this.applications.listMine(1, 5).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.applicantApplications.set(result.items);
        this.totalApplications.set(result.total);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Unable to load your application summary.');
        this.loading.set(false);
      },
    });
  }

  private loadStaffDashboard(): void {
    this.approvals.list(1, 5).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.reviewQueue.set(result.items);
        this.totalReviewable.set(result.total);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Unable to load the review summary.');
        this.loading.set(false);
      },
    });
  }

  retry(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.ngOnInit();
  }
}
