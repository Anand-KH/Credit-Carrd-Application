import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-forbidden-page',
  imports: [RouterLink, MatButtonModule, MatIconModule],
  template: `
    <section class="surface notice">
      <span class="icon" aria-hidden="true"><mat-icon>lock</mat-icon></span>
      <h1>Access denied</h1>
      <p class="muted">Your account does not have permission to open this page.</p>
      <a mat-flat-button routerLink="/dashboard">Return to your portal</a>
    </section>
  `,
  styles: [`
    .notice { display: grid; justify-items: center; gap: .5rem; max-width: 30rem; margin: 4rem auto; text-align: center; }
    .icon { display: grid; width: 3.5rem; height: 3.5rem; place-items: center; border-radius: 1rem; background: var(--app-danger-bg); color: var(--app-danger-fg); }
    h1 { margin: .5rem 0 0; font-size: 1.5rem; }
    p { margin: 0 0 1rem; }
  `],
})
export class ForbiddenPage {}
