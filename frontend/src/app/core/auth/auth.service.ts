import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { API_BASE_URL } from './api-url';
import { AuthResponse, AuthUser, LoginRequest, RegistrationRequest } from './auth.models';

/**
 * Session is kept in sessionStorage (per-tab, cleared when the tab closes) so a
 * page refresh does not log the user out. The access token is short-lived
 * (15 minutes) and the session is cleared automatically when it expires.
 */
export const SESSION_STORAGE_KEY = 'cca.session';

interface StoredSession {
  accessToken: string;
  user: AuthUser;
  expiresAt: number;
}

function readStoredSession(now: number): StoredSession | null {
  try {
    const raw = globalThis.sessionStorage?.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (
      typeof parsed.accessToken !== 'string'
      || typeof parsed.expiresAt !== 'number'
      || !parsed.user
      || parsed.expiresAt <= now
    ) {
      globalThis.sessionStorage?.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return parsed as StoredSession;
  } catch {
    return null;
  }
}

function writeStoredSession(session: StoredSession | null): void {
  try {
    if (session) {
      globalThis.sessionStorage?.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } else {
      globalThis.sessionStorage?.removeItem(SESSION_STORAGE_KEY);
    }
  } catch {
    // Storage can be unavailable (private mode, blocked site data); the
    // in-memory session still works for the lifetime of the page.
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly apiBaseUrl = inject(API_BASE_URL);
  private readonly sessionToken = signal<string | null>(null);
  private readonly sessionUser = signal<AuthUser | null>(null);
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;

  readonly currentUser = this.sessionUser.asReadonly();
  readonly isAuthenticated = computed(() => this.sessionUser() !== null);

  constructor() {
    const stored = readStoredSession(Date.now());
    if (stored) {
      this.applySession(stored);
    }
    inject(DestroyRef).onDestroy(() => this.clearExpiryTimer());
  }

  get accessToken(): string | null {
    return this.sessionToken();
  }

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiBaseUrl}/auth/login`, credentials)
      .pipe(tap((response) => this.setSession(response)));
  }

  register(details: RegistrationRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiBaseUrl}/auth/register`, details);
  }

  logout(): void {
    this.clearExpiryTimer();
    this.sessionToken.set(null);
    this.sessionUser.set(null);
    writeStoredSession(null);
  }

  /** Ends the session because the token expired or was rejected, and sends the user to sign in again. */
  expireSession(): void {
    if (!this.isAuthenticated()) return;
    const returnUrl = this.router.url;
    this.logout();
    void this.router.navigate(['/login'], {
      queryParams: {
        reason: 'session-expired',
        ...(returnUrl && !returnUrl.startsWith('/login') ? { returnUrl } : {}),
      },
    });
  }

  private setSession(response: AuthResponse): void {
    const session: StoredSession = {
      accessToken: response.accessToken,
      user: response.user,
      expiresAt: Date.now() + response.expiresInSeconds * 1000,
    };
    writeStoredSession(session);
    this.applySession(session);
  }

  private applySession(session: StoredSession): void {
    this.sessionToken.set(session.accessToken);
    this.sessionUser.set(session.user);
    this.clearExpiryTimer();
    this.expiryTimer = setTimeout(() => this.expireSession(), Math.max(0, session.expiresAt - Date.now()));
  }

  private clearExpiryTimer(): void {
    if (this.expiryTimer !== null) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }
  }
}
