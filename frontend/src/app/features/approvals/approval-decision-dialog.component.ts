import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-approval-decision-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  styles: [`
    mat-dialog-content {
      box-sizing: border-box;
      width: 100%;
      min-width: 0;
      max-height: none;
      overflow: visible;
    }

    .manual-review-fields {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      align-items: start;
      gap: 1rem;
      width: 100%;
      min-width: 0;
    }

    .manual-review-fields mat-form-field,
    .reason-field {
      width: 100%;
      min-width: 0;
    }

    .field-error {
      margin: -0.25rem 0 0.75rem;
      color: #9c2520;
      font-size: 0.8rem;
    }
  `],
  template: `
    <h2 mat-dialog-title>{{ data.decision === 'manual_review' ? 'Submit manual credit-limit review' : data.decision === 'approved' ? 'Approve application' : 'Reject application' }}</h2>
    <mat-dialog-content>
      @if (data.decision === 'manual_review') {
        <p>Recommend a credit limit for administrator approval.</p>
        <div class="manual-review-fields">
          <mat-form-field appearance="outline">
            <mat-label>Recommended credit limit (INR)</mat-label>
            <input matInput type="number" [formControl]="creditLimit" min="1">
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Reason</mat-label>
            <textarea matInput [formControl]="reason" rows="4"></textarea>
          </mat-form-field>
        </div>
      } @else {
        <p>Provide a reason for this decision.</p>
        <mat-form-field class="reason-field" appearance="outline">
          <mat-label>Reason</mat-label>
          <textarea matInput [formControl]="reason" rows="4"></textarea>
        </mat-form-field>
      }
      @if (reason.touched && (reason.hasError('required') || reason.hasError('minlength'))) {
        <p class="field-error" role="alert">A reason of at least 5 characters is required.</p>
      } @else if (reason.touched && reason.hasError('maxlength')) {
        <p class="field-error" role="alert">Reason must be 1000 characters or fewer.</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [disabled]="reason.invalid || (data.decision === 'manual_review' && creditLimit.invalid)" (click)="submit()">Confirm</button>
    </mat-dialog-actions>
  `,
})
export class ApprovalDecisionDialogComponent {
  readonly data = inject<{ decision: 'approved' | 'rejected' | 'manual_review' }>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ApprovalDecisionDialogComponent>);
  readonly reason = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(5), Validators.maxLength(1000)] });
  readonly creditLimit = new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(1), Validators.max(10000000)] });

  submit(): void {
    if (this.reason.valid && (this.data.decision !== 'manual_review' || this.creditLimit.valid)) {
      this.dialogRef.close({ reason: this.reason.value, creditLimit: this.creditLimit.value });
    }
  }
}
