import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { ApplicationTracking } from '../../core/applications/application.models';
import { ApplicationService } from '../../core/applications/application.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator.component';
import { StatusChipComponent } from '../../shared/ui/status-chip.component';

@Component({
  selector: 'app-application-tracking-page',
  imports: [DatePipe, MatButtonModule, MatCardModule, MatIconModule, RouterLink, EmptyStateComponent, LoadingIndicatorComponent, StatusChipComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './application-tracking.page.html',
  styleUrl: './application-tracking.page.scss',
})
export class ApplicationTrackingPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(ApplicationService);
  private readonly destroyRef = inject(DestroyRef);
  readonly tracking = signal<ApplicationTracking | null>(null);
  readonly loading = signal(true);
  readonly errorMessage = signal('');

  ngOnInit(): void {
    const applicationNumber = this.route.snapshot.paramMap.get('applicationNumber');
    if (!applicationNumber) {
      this.errorMessage.set('A valid application number is required.');
      this.loading.set(false);
      return;
    }
    this.service.track(applicationNumber).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.tracking.set(result.application);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Application not found or unavailable for your account.');
        this.loading.set(false);
      },
    });
  }
}
