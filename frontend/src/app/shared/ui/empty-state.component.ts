import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-empty-state',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="empty" aria-live="polite">
      <mat-icon aria-hidden="true">{{ icon() }}</mat-icon>
      <h2>{{ title() }}</h2>
      <p>{{ message() }}</p>
      <ng-content />
    </section>
  `,
  styles: [`
    .empty { display: grid; justify-items: center; gap: .5rem; padding: 3rem 1rem; text-align: center; color: var(--mat-sys-on-surface-variant); }
    mat-icon { width: 2rem; height: 2rem; font-size: 2rem; }
    h2, p { margin: 0; }
  `],
})
export class EmptyStateComponent {
  readonly icon = input('inbox');
  readonly title = input('Nothing here yet');
  readonly message = input('There is no data to display.');
}
