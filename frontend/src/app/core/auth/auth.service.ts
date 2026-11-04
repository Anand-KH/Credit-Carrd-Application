import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { API_BASE_URL } from './api-url';
import { AuthResponse, AuthUser, LoginRequest, RegistrationRequest } from './auth.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);
  private readonly sessionToken = signal<string | null>(null);
  private readonly sessionUser = signal<AuthUser | null>(null);

  readonly currentUser = this.sessionUser.asReadonly();
  readonly isAuthenticated = computed(() => this.sessionUser() !== null);

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
    this.sessionToken.set(null);
    this.sessionUser.set(null);
  }

  private setSession(response: AuthResponse): void {
    this.sessionToken.set(response.accessToken);
    this.sessionUser.set(response.user);
  }
}
