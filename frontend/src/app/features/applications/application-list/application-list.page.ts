import { Component, inject, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe, DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { ApplicationService } from '../../../core/applications/application.service';
import { ApplicantApplication } from '../../../core/applications/application.models';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { LoadingIndicatorComponent } from '../../../shared/ui/loading-indicator.component';
import { StatusChipComponent } from '../../../shared/ui/status-chip.component';

@Component({
  selector: 'app-application-list-page',
  imports: [DatePipe, DecimalPipe, MatButtonModule, RouterLink, EmptyStateComponent, LoadingIndicatorComponent, StatusChipComponent],
  templateUrl: './application-list.page.html',
  styleUrl: './application-list.page.scss',
})
export class ApplicationListPage implements OnInit {
  private readonly applicationService = inject(ApplicationService);
  readonly applications = signal<ApplicantApplication[]>([]);
  readonly page = signal(1);
  readonly totalPages = signal(0);
  readonly loading = signal(false);
  readonly errorMessage = signal('');

  ngOnInit(): void {
    this.loadPage();
  }

  loadPage(page = this.page()): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.applicationService.listMine(page).subscribe({
      next: (result) => {
        this.applications.set(result.items);
        this.page.set(result.page);
        this.totalPages.set(result.totalPages);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.errorMessage.set(error instanceof HttpErrorResponse
          ? error.error?.error?.message ?? 'Unable to load applications.'
          : 'Unable to load applications.');
        this.loading.set(false);
      },
    });
  }

  previousPage(): void {
    if (this.page() > 1) this.loadPage(this.page() - 1);
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) this.loadPage(this.page() + 1);
  }
}
