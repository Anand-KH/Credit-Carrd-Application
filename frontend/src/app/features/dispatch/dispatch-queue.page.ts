import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { DispatchService } from '../../core/dispatch/dispatch.service';
import { CardDispatch, DispatchStatus } from '../../core/dispatch/dispatch.models';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator.component';
import { StatusChipComponent } from '../../shared/ui/status-chip.component';

@Component({
  selector: 'app-dispatch-queue-page',
  imports: [DatePipe, MatButtonModule, MatFormFieldModule, MatIconModule, MatSelectModule, EmptyStateComponent, LoadingIndicatorComponent, StatusChipComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dispatch-queue.page.html',
  styleUrl: './dispatch-queue.page.scss',
})
export class DispatchQueuePage implements OnInit {
  private readonly service = inject(DispatchService);
  private readonly destroyRef = inject(DestroyRef);
  readonly dispatches = signal<CardDispatch[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly page = signal(1);
  readonly totalPages = signal(0);
  readonly status = signal('');
  readonly statusSelections = signal<Record<string, DispatchStatus>>({});
  readonly updatingApplication = signal('');

  ngOnInit(): void { this.load(); }

  load(page = this.page()): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.service.list(page, 10, this.status()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.dispatches.set(result.items);
        this.page.set(result.page);
        this.totalPages.set(result.totalPages);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.errorMessage.set(error instanceof HttpErrorResponse ? error.error?.error?.message ?? 'Unable to load dispatch queue.' : 'Unable to load dispatch queue.');
        this.loading.set(false);
      },
    });
  }

  selectedStatus(dispatch: CardDispatch): DispatchStatus {
    return this.statusSelections()[dispatch.applicationNumber] ?? dispatch.dispatchStatus;
  }

  setSelectedStatus(dispatch: CardDispatch, status: DispatchStatus): void {
    this.statusSelections.update((selections) => ({
      ...selections,
      [dispatch.applicationNumber]: status,
    }));
  }

  updateDispatch(dispatch: CardDispatch): void {
    const nextStatus = this.selectedStatus(dispatch);
    if (dispatch.dispatchReference && nextStatus === dispatch.dispatchStatus) return;
    this.successMessage.set('');
    this.errorMessage.set('');
    this.updatingApplication.set(dispatch.applicationNumber);
    this.service.update(dispatch.applicationNumber, nextStatus)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.successMessage.set('Dispatch information updated successfully.');
          this.updatingApplication.set('');
          this.load(1);
        },
        error: (error: unknown) => {
          this.errorMessage.set(error instanceof HttpErrorResponse ? error.error?.error?.message ?? 'Unable to update dispatch information.' : 'Unable to update dispatch information.');
          this.updatingApplication.set('');
        },
      });
  }

  setStatus(value: string): void { this.status.set(value); this.load(1); }
  previousPage(): void { if (this.page() > 1) this.load(this.page() - 1); }
  nextPage(): void { if (this.page() < this.totalPages()) this.load(this.page() + 1); }
}
