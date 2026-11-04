import { Component, inject, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe, DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { ApprovalService } from '../../core/approvals/approval.service';
import { ApprovalApplication } from '../../core/approvals/approval.models';
import { ApprovalDecisionDialogComponent } from './approval-decision-dialog.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ErrorMessageComponent } from '../../shared/ui/error-message.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator.component';
import { StatusChipComponent } from '../../shared/ui/status-chip.component';

@Component({
  selector: 'app-approval-dashboard-page',
  imports: [DatePipe, DecimalPipe, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, RouterLink, EmptyStateComponent, ErrorMessageComponent, LoadingIndicatorComponent, StatusChipComponent],
  templateUrl: './approval-dashboard.page.html',
  styleUrl: './approval-dashboard.page.scss',
})
export class ApprovalDashboardPage implements OnInit {
  private readonly service = inject(ApprovalService);
  private readonly dialog = inject(MatDialog);
  readonly applications = signal<ApprovalApplication[]>([]);
  readonly status = signal('');
  readonly search = signal('');
  readonly page = signal(1);
  readonly totalPages = signal(0);
  readonly loading = signal(false);
  readonly errorMessage = signal('');

  ngOnInit(): void { this.load(); }

  load(page = this.page()): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.service.list(page, 10, this.status(), this.search()).subscribe({
      next: (result) => {
        this.applications.set(result.items);
        this.page.set(result.page);
        this.totalPages.set(result.totalPages);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.errorMessage.set(error instanceof HttpErrorResponse ? error.error?.error?.message ?? 'Unable to load approvals.' : 'Unable to load approvals.');
        this.loading.set(false);
      },
    });
  }

  decide(application: ApprovalApplication, decision: 'approved' | 'rejected'): void {
    const dialogRef = this.dialog.open(ApprovalDecisionDialogComponent, { data: { decision }, width: '32rem' });
    dialogRef.afterClosed().subscribe((reason: string | undefined) => {
      if (!reason) return;
      this.loading.set(true);
      this.service.decide(application.applicationNumber, decision, reason).subscribe({
        next: () => this.load(),
        error: (error: unknown) => {
          this.errorMessage.set(error instanceof HttpErrorResponse ? error.error?.error?.message ?? 'Unable to record decision.' : 'Unable to record decision.');
          this.loading.set(false);
        },
      });
    });
  }

  setStatus(value: string): void { this.status.set(value); this.load(1); }
  setSearch(value: string): void { this.search.set(value); }
  applySearch(): void { this.load(1); }
  previousPage(): void { if (this.page() > 1) this.load(this.page() - 1); }
  nextPage(): void { if (this.page() < this.totalPages()) this.load(this.page() + 1); }
}
