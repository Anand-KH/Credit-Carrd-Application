import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { ReportingService } from '../../core/reporting/reporting.service';
import { ApplicationCounts, ApplicationReport } from '../../core/reporting/reporting.models';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator.component';
import { StatusChipComponent } from '../../shared/ui/status-chip.component';

@Component({
  selector: 'app-admin-dashboard-page',
  imports: [DatePipe, DecimalPipe, ReactiveFormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule, RouterLink, EmptyStateComponent, LoadingIndicatorComponent, StatusChipComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-dashboard.page.html',
  styleUrl: './admin-dashboard.page.scss',
})
export class AdminDashboardPage implements OnInit {
  private readonly service = inject(ReportingService);
  private readonly destroyRef = inject(DestroyRef);
  readonly counts = signal<ApplicationCounts | null>(null);
  readonly applications = signal<ApplicationReport[]>([]);
  readonly page = signal(1);
  readonly totalPages = signal(0);
  readonly loading = signal(true);
  readonly errorMessage = signal('');
  readonly status = new FormControl('', { nonNullable: true });
  readonly search = new FormControl('', { nonNullable: true });
  readonly dateFrom = new FormControl('', { nonNullable: true });
  readonly dateTo = new FormControl('', { nonNullable: true });
  readonly statuses: (keyof ApplicationCounts)[] = [
    'submitted',
    'under_review',
    'manual_review',
    'pending_admin_approval',
    'approved',
    'rejected',
    'dispatched',
  ];

  ngOnInit(): void { this.load(); }

  load(page = this.page()): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.service.counts().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => this.counts.set(result.counts),
      error: () => this.errorMessage.set('Unable to load application counts.'),
    });
    this.service.applications({
      page,
      limit: 10,
      status: this.status.value,
      search: this.search.value,
      dateFrom: this.dateFrom.value,
      dateTo: this.dateTo.value,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.applications.set(result.items);
        this.page.set(result.page);
        this.totalPages.set(result.totalPages);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Unable to load application reports.');
        this.loading.set(false);
      },
    });
  }

  applyFilters(): void { this.load(1); }
  previousPage(): void { if (this.page() > 1) this.load(this.page() - 1); }
  nextPage(): void { if (this.page() < this.totalPages()) this.load(this.page() + 1); }
  maximumCount(): number {
    const values = this.counts() ? Object.values(this.counts()!) : [];
    return Math.max(...values, 1);
  }
  barWidth(status: keyof ApplicationCounts): string {
    return `${((this.counts()?.[status] ?? 0) / this.maximumCount()) * 100}%`;
  }
}
