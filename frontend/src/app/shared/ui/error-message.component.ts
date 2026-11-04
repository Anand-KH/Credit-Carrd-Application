import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-error-message',
  imports: [MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="error" role="alert">
      <mat-icon aria-hidden="true">error_outline</mat-icon>
      <span>{{ message() }}</span>
      @if (showRetry()) {
        <button mat-stroked-button type="button" (click)="retry.emit()">Try again</button>
      }
    </section>
  `,
  styles: [`
    .error { display: flex; align-items: center; flex-wrap: wrap; gap: .75rem; padding: 1rem; border: 1px solid var(--mat-sys-error); border-radius: .75rem; color: var(--mat-sys-error); }
  `],
})
export class ErrorMessageComponent {
  readonly message = input('Something went wrong.');
  readonly showRetry = input(true);
  readonly retry = output<void>();
}
