import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';

@Component({
  selector: 'app-status-chip',
  imports: [MatChipsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<mat-chip [class]="tone()">{{ label() }}</mat-chip>`,
  styles: [`
    mat-chip { text-transform: capitalize; }
    .positive { --mdc-chip-elevated-container-color: #d9f5e9; --mdc-chip-label-text-color: #12623f; }
    .negative { --mdc-chip-elevated-container-color: #fde1e1; --mdc-chip-label-text-color: #9c2c2c; }
    .attention { --mdc-chip-elevated-container-color: #fff0c2; --mdc-chip-label-text-color: #765400; }
  `],
})
export class StatusChipComponent {
  readonly status = input.required<string>();
  readonly label = computed(() => this.status().replaceAll('_', ' '));
  readonly tone = computed(() => {
    const status = this.status();
    if (['approved', 'dispatched'].includes(status)) return 'positive';
    if (['rejected', 'blocked'].includes(status)) return 'negative';
    return 'attention';
  });
}
