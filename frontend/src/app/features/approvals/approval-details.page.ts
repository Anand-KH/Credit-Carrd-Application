import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { ApprovalService } from '../../core/approvals/approval.service';
import { ApprovalApplication } from '../../core/approvals/approval.models';

@Component({
  selector: 'app-approval-details-page',
  imports: [DatePipe, DecimalPipe, MatButtonModule, RouterLink],
  templateUrl: './approval-details.page.html',
  styleUrl: './approval-details.page.scss',
})
export class ApprovalDetailsPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(ApprovalService);
  readonly application = signal<ApprovalApplication | null>(null);
  readonly errorMessage = signal('');

  ngOnInit(): void {
    const number = this.route.snapshot.paramMap.get('applicationNumber');
    if (!number) { this.errorMessage.set('Application number is required.'); return; }
    this.service.get(number).subscribe({
      next: (result) => this.application.set(result.application),
      error: () => this.errorMessage.set('Unable to load application details.'),
    });
  }
}
