import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-forbidden-page',
  imports: [RouterLink],
  template: `
    <section class="notice">
      <h1>Access denied</h1>
      <p>Your account does not have permission to open this page.</p>
      <a routerLink="/login">Return to your portal</a>
    </section>
  `,
  styles: [`
    .notice { max-width: 40rem; margin: 4rem auto; padding: 2rem; border-radius: 1rem; background: #fff; }
  `],
})
export class ForbiddenPage {}
