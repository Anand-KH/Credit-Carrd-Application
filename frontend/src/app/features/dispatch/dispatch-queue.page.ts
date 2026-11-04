import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { DispatchService } from '../../core/dispatch/dispatch.service';
import { CardDispatch, DispatchStatus } from '../../core/dispatch/dispatch.models';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ErrorMessageComponent } from '../../shared/ui/error-message.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator.component';
import { StatusChipComponent } from '../../shared/ui/status-chip.component';

@Component({
  selector: 'app-dispatch-queue-page',
  imports: [DatePipe, ReactiveFormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule, EmptyStateComponent, ErrorMessageComponent, LoadingIndicatorComponent, StatusChipComponent],
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
  readonly applicationNumber = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^APP-[A-Z0-9-]+$/)] });
  readonly dispatchReference = new FormControl('', { nonNullable: true, validators: [Validators.pattern(/^DSP-[A-Z0-9-]*$/)] });
  readonly dispatchStatus = new FormControl<DispatchStatus>('pending', { nonNullable: true });

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

  updateDispatch(): void {
    this.successMessage.set('');
    this.errorMessage.set('');
    if (this.applicationNumber.invalid || this.dispatchReference.invalid) {
      this.applicationNumber.markAsTouched();
      this.dispatchReference.markAsTouched();
      return;
    }
    this.loading.set(true);
    this.service.update(this.applicationNumber.value.trim().toUpperCase(), this.dispatchStatus.value, this.dispatchReference.value.trim() || undefined)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.successMessage.set('Dispatch information updated successfully.');
          this.applicationNumber.reset('');
          this.dispatchReference.reset('');
          this.dispatchStatus.setValue('pending');
          this.load(1);
        },
        error: (error: unknown) => {
          this.errorMessage.set(error instanceof HttpErrorResponse ? error.error?.error?.message ?? 'Unable to update dispatch information.' : 'Unable to update dispatch information.');
          this.loading.set(false);
        },
      });
  }

  setStatus(value: string): void { this.status.set(value); this.load(1); }
  previousPage(): void { if (this.page() > 1) this.load(this.page() - 1); }
  nextPage(): void { if (this.page() < this.totalPages()) this.load(this.page() + 1); }
}
