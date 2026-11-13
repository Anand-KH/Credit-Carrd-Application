import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ApplicationService } from '../../../core/applications/application.service';
import {
  ApplicantApplication,
  ApplicationSubmission,
} from '../../../core/applications/application.models';

@Component({
  selector: 'app-application-form-page',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
    RouterLink,
  ],
  templateUrl: './application-form.page.html',
  styleUrl: './application-form.page.scss',
})
export class ApplicationFormPage {
  private readonly formBuilder = inject(FormBuilder);
  private readonly applicationService = inject(ApplicationService);

  readonly submitting = signal(false);
  readonly errorMessage = signal('');
  readonly submittedApplication = signal<ApplicantApplication | null>(null);
  readonly form = this.formBuilder.nonNullable.group({
    dateOfBirth: ['', Validators.required],
    gender: ['', Validators.required],
    phone: ['', [Validators.required, Validators.pattern(/^[0-9+()\-\s]{8,20}$/)]],
    address: this.formBuilder.nonNullable.group({
      line1: ['', Validators.required],
      line2: [''],
      city: ['', Validators.required],
      state: ['', Validators.required],
      postalCode: ['', Validators.required],
      country: ['India', Validators.required],
    }),
    annualIncome: [0, [Validators.required, Validators.min(0), Validators.max(1000000000)]],
    employmentType: ['', Validators.required],
    panLast4: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9]{4}$/)]],
  });

  submit(): void {
    this.errorMessage.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    const submission = this.form.getRawValue() as ApplicationSubmission;
    this.applicationService.submit(submission).subscribe({
      next: ({ application }) => {
        this.submittedApplication.set(application);
        this.submitting.set(false);
      },
      error: (error: unknown) => {
        this.errorMessage.set(this.getErrorMessage(error));
        this.submitting.set(false);
      },
    });
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      return error.error?.error?.message ?? 'Unable to submit the application.';
    }
    return 'Unable to submit the application.';
  }
}
