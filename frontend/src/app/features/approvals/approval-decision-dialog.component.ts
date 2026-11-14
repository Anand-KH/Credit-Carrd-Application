import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-approval-decision-dialog',
  imports: [ReactiveFormsModule, DecimalPipe, MatDialogModule, MatButtonModule, MatCheckboxModule, MatFormFieldModule, MatInputModule],
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

    .limit-confirmation {
      display: block;
      margin-bottom: 0.75rem;
    }

    .field-error {
      margin: -0.25rem 0 0.75rem;
      color: var(--app-danger-fg);
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
      @if (requiresLimitConfirmation) {
        <mat-checkbox class="limit-confirmation" [formControl]="confirmLimit">
          I confirm the flagged credit limit of INR {{ data.creditLimitToConfirm | number }} is intended.
        </mat-checkbox>
      }
      @if (reason.touched && (reason.hasError('required') || reason.hasError('minlength'))) {
        <p class="field-error" role="alert">A reason of at least 5 characters is required.</p>
      } @else if (reason.touched && reason.hasError('maxlength')) {
        <p class="field-error" role="alert">Reason must be 1000 characters or fewer.</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [disabled]="!canSubmit()" (click)="submit()">Confirm</button>
    </mat-dialog-actions>
  `,
})
export class ApprovalDecisionDialogComponent {
  readonly data = inject<{
    decision: 'approved' | 'rejected' | 'manual_review';
    /** Set when the backend flagged the limit as unusual and approval needs explicit confirmation. */
    creditLimitToConfirm?: number | null;
  }>(MAT_DIALOG_DATA);
  readonly requiresLimitConfirmation = this.data.decision === 'approved'
    && this.data.creditLimitToConfirm !== undefined;
  private readonly dialogRef = inject(MatDialogRef<ApprovalDecisionDialogComponent>);
  readonly reason = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(5), Validators.maxLength(1000)] });
  readonly creditLimit = new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(1), Validators.max(10000000)] });

  readonly confirmLimit = new FormControl(false, { nonNullable: true });

  canSubmit(): boolean {
    return this.reason.valid
      && (this.data.decision !== 'manual_review' || this.creditLimit.valid)
      && (!this.requiresLimitConfirmation || this.confirmLimit.value);
  }

  submit(): void {
    if (this.canSubmit()) {
      this.dialogRef.close({
        reason: this.reason.value,
        creditLimit: this.creditLimit.value,
        confirmCreditLimit: this.requiresLimitConfirmation && this.confirmLimit.value,
      });
    }
  }
}
