import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-staff-page',
  imports: [RouterLink, MatButtonModule],
  template: `
    <section class="welcome-card">
      <p class="eyebrow">Staff portal</p>
      <h1>Access granted</h1>
      <p>Your server-verified role permits access to this protected area.</p>
      <a mat-flat-button color="primary" routerLink="/approvals">Open approval queue</a>
    </section>
  `,
  styles: [`
    .welcome-card { max-width: 46rem; margin: 4rem auto; padding: 2rem; border-radius: 1rem; background: #fff; }
    .eyebrow { color: #176b59; font-size: .8rem; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
  `],
})
export class StaffPage {}
