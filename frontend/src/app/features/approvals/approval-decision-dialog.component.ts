import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-approval-decision-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>{{ data.decision === 'approved' ? 'Approve application' : 'Reject application' }}</h2>
    <mat-dialog-content>
      <p>Provide a reason for this decision.</p>
      <mat-form-field appearance="outline">
        <mat-label>Reason</mat-label>
        <textarea matInput [formControl]="reason" rows="4"></textarea>
        @if (reason.hasError('required') || reason.hasError('minlength')) {
          <mat-error>A reason of at least 5 characters is required.</mat-error>
        }
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [disabled]="reason.invalid" (click)="submit()">Confirm</button>
    </mat-dialog-actions>
  `,
})
export class ApprovalDecisionDialogComponent {
  readonly data = inject<{ decision: 'approved' | 'rejected' }>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ApprovalDecisionDialogComponent>);
  readonly reason = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(5), Validators.maxLength(1000)] });

  submit(): void {
    if (this.reason.valid) this.dialogRef.close(this.reason.value);
  }
}
