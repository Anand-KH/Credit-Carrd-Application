import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { DatePipe, JsonPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { RouterLink } from '@angular/router';
import { ReportingService } from '../../core/reporting/reporting.service';
import { AuditEntry } from '../../core/reporting/reporting.models';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ErrorMessageComponent } from '../../shared/ui/error-message.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator.component';

@Component({
  selector: 'app-audit-history-page',
  imports: [DatePipe, JsonPipe, ReactiveFormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule, RouterLink, EmptyStateComponent, ErrorMessageComponent, LoadingIndicatorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './audit-history.page.html',
  styleUrl: './audit-history.page.scss',
})
export class AuditHistoryPage implements OnInit {
  private readonly service = inject(ReportingService);
  private readonly destroyRef = inject(DestroyRef);
  readonly entries = signal<AuditEntry[]>([]);
  readonly page = signal(1);
  readonly totalPages = signal(0);
  readonly loading = signal(true);
  readonly errorMessage = signal('');
  readonly action = new FormControl('', { nonNullable: true });
  readonly targetResource = new FormControl('', { nonNullable: true });

  ngOnInit(): void { this.load(); }
  load(page = this.page()): void {
    this.loading.set(true);
    this.service.audits({ page, limit: 20, action: this.action.value, targetResource: this.targetResource.value }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => { this.entries.set(result.items); this.page.set(result.page); this.totalPages.set(result.totalPages); this.loading.set(false); },
      error: () => { this.errorMessage.set('Unable to load audit history.'); this.loading.set(false); },
    });
  }
  applyFilters(): void { this.load(1); }
  previousPage(): void { if (this.page() > 1) this.load(this.page() - 1); }
  nextPage(): void { if (this.page() < this.totalPages()) this.load(this.page() + 1); }
}
