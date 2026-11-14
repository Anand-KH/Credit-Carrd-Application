import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

type Tone = 'positive' | 'negative' | 'attention' | 'info' | 'neutral';

const TONES: Record<string, Tone> = {
  approved: 'positive',
  dispatched: 'positive',
  delivered: 'positive',
  rejected: 'negative',
  failed: 'negative',
  blocked: 'negative',
  manual_review: 'attention',
  pending_admin_approval: 'attention',
  pending: 'attention',
  submitted: 'info',
  under_review: 'info',
  in_transit: 'info',
};

@Component({
  selector: 'app-status-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="pill" [class]="'pill pill--' + tone()">{{ label() }}</span>`,
  styles: [`
    :host { display: inline-flex; }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: .4rem;
      padding: .2rem .65rem .2rem .55rem;
      border-radius: 999px;
      font-size: .78rem;
      font-weight: 600;
      line-height: 1.4;
      text-transform: capitalize;
      white-space: nowrap;
    }
    .pill::before { content: ''; width: .45rem; height: .45rem; border-radius: 50%; background: currentColor; }
    .pill--positive { background: var(--app-success-bg); color: var(--app-success-fg); }
    .pill--negative { background: var(--app-danger-bg); color: var(--app-danger-fg); }
    .pill--attention { background: var(--app-warning-bg); color: var(--app-warning-fg); }
    .pill--info { background: var(--app-info-bg); color: var(--app-info-fg); }
    .pill--neutral { background: var(--app-surface-muted); color: var(--app-text-muted); }
  `],
})
export class StatusChipComponent {
  readonly status = input.required<string>();
  readonly label = computed(() => this.status().replaceAll('_', ' '));
  readonly tone = computed<Tone>(() => TONES[this.status()] ?? 'neutral');
}
