import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-loading-indicator',
  imports: [MatProgressSpinnerModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="loading" role="status" aria-live="polite">
      <mat-spinner diameter="32" />
      <span>{{ label() }}</span>
    </div>
  `,
  styles: [`.loading { display: flex; align-items: center; justify-content: center; gap: .75rem; min-height: 8rem; color: var(--app-text-muted); }`],
})
export class LoadingIndicatorComponent {
  readonly label = input('Loading...');
}
