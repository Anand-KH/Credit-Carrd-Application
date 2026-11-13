import { ChangeDetectionStrategy, Component, input } from '@angular/core';

let nextId = 0;

/**
 * CrediCard logo: the Material "credit_card" glyph on the brand gradient tile,
 * optionally followed by the wordmark. The glyph is inlined as SVG (same path
 * as the Material icon) so it renders identically to the favicon and does not
 * depend on the icon font loading. public/favicon.svg uses the same artwork.
 */
@Component({
  selector: 'app-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.logo--light]': "tone() === 'light'",
    '[style.--logo-size.px]': 'size()',
  },
  template: `
    <svg class="logo__mark" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient [attr.id]="gradientId" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#1e3a8a" />
          <stop offset="0.45" stop-color="#1e40af" />
          <stop offset="1" stop-color="#0d9488" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" [attr.fill]="'url(#' + gradientId + ')'" />
      <path
        transform="translate(12 12)"
        fill="#ffffff"
        d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"
      />
    </svg>
    @if (showWordmark()) {
      <span class="logo__wordmark">CrediCard</span>
    }
  `,
  styles: [`
    :host {
      --logo-size: 34px;
      display: inline-flex;
      align-items: center;
      gap: calc(var(--logo-size) * 0.3);
      color: var(--mat-sys-on-surface);
      line-height: 1;
    }
    :host(.logo--light) { color: #fff; }
    .logo__mark {
      flex: 0 0 auto;
      width: var(--logo-size);
      height: var(--logo-size);
      border-radius: calc(var(--logo-size) * 0.27);
      box-shadow: 0 4px 12px rgb(13 148 136 / 30%);
    }
    .logo__wordmark {
      font-size: calc(var(--logo-size) * 0.52);
      font-weight: 700;
      letter-spacing: -0.01em;
    }
  `],
})
export class LogoComponent {
  /** Mark size in pixels; the wordmark scales with it. */
  readonly size = input(34);
  readonly showWordmark = input(true);
  /** 'light' for dark backgrounds (sidebar, brand panel). */
  readonly tone = input<'default' | 'light'>('default');
  readonly gradientId = `credicard-logo-gradient-${nextId++}`;
}
