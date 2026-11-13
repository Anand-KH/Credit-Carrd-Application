import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-empty-state',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="empty" aria-live="polite">
      <span class="icon" aria-hidden="true"><mat-icon>{{ icon() }}</mat-icon></span>
      <h2>{{ title() }}</h2>
      <p>{{ message() }}</p>
      <ng-content />
    </section>
  `,
  styles: [`
    .empty { display: grid; justify-items: center; gap: .5rem; padding: 3rem 1rem; text-align: center; color: var(--app-text-muted); }
    .icon { display: grid; width: 3.5rem; height: 3.5rem; margin-bottom: .5rem; place-items: center; border-radius: 1rem; background: var(--app-info-bg); color: var(--app-info-fg); }
    h2 { margin: 0; color: var(--mat-sys-on-surface); font-size: 1.05rem; font-weight: 650; }
    p { max-width: 28rem; margin: 0 0 .5rem; }
  `],
})
export class EmptyStateComponent {
  readonly icon = input('inbox');
  readonly title = input('Nothing here yet');
  readonly message = input('There is no data to display.');
}
