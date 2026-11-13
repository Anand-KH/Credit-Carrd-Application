import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_BASE_URL } from './api-url';
import { authInterceptor } from './auth.interceptor';
import { AuthService, SESSION_STORAGE_KEY } from './auth.service';
import { AuthResponse } from './auth.models';
import { httpErrorInterceptor, SHOW_ERROR_TOAST } from '../http-error.interceptor';
import { ToastService } from '../../shared/ui/toast.service';

const apiBaseUrl = 'http://localhost:3000/api';

function authResponse(overrides: Partial<AuthResponse> = {}): AuthResponse {
  return {
    user: {
      id: 'user-id',
      name: 'Fictional Applicant',
      email: 'applicant@example.test',
      role: 'APPLICANT',
    },
    accessToken: 'short-lived-test-token',
    tokenType: 'Bearer',
    expiresInSeconds: 900,
    ...overrides,
  };
}

describe('AuthService', () => {
  let toast: { showError: ReturnType<typeof vi.fn> };

  function setup(): { authService: AuthService; http: HttpTestingController } {
    toast = { showError: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor, httpErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: apiBaseUrl },
        { provide: ToastService, useValue: toast },
      ],
    });
    return {
      authService: TestBed.inject(AuthService),
      http: TestBed.inject(HttpTestingController),
    };
  }

  function signIn(authService: AuthService, http: HttpTestingController, response = authResponse()): void {
    authService.login({ email: response.user.email, password: 'a-safe-test-password-2026' }).subscribe();
    http.expectOne(`${apiBaseUrl}/auth/login`).flush(response);
  }

  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    vi.useRealTimers();
    sessionStorage.clear();
  });

  it('stores the session, restores it after a reload, and clears it on logout', () => {
    const { authService, http } = setup();
    const response = authResponse();

    authService.login({ email: response.user.email, password: 'a-safe-test-password-2026' }).subscribe();
    const loginRequest = http.expectOne(`${apiBaseUrl}/auth/login`);
    expect(loginRequest.request.headers.has('Authorization')).toBe(false);
    loginRequest.flush(response);

    expect(authService.accessToken).toBe(response.accessToken);
    expect(authService.currentUser()).toEqual(response.user);
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toContain(response.accessToken);

    // A fresh service instance simulates a page reload.
    TestBed.resetTestingModule();
    const reloaded = setup().authService;
    expect(reloaded.isAuthenticated()).toBe(true);
    expect(reloaded.accessToken).toBe(response.accessToken);

    reloaded.logout();
    expect(reloaded.accessToken).toBeNull();
    expect(reloaded.isAuthenticated()).toBe(false);
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('ignores an expired stored session', () => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
      accessToken: 'old-token',
      user: authResponse().user,
      expiresAt: Date.now() - 1000,
    }));
    const { authService } = setup();
    expect(authService.isAuthenticated()).toBe(false);
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('logs out and redirects to sign-in when the token expires', () => {
    vi.useFakeTimers();
    const { authService, http } = setup();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    signIn(authService, http, authResponse({ expiresInSeconds: 60 }));

    vi.advanceTimersByTime(60_000);

    expect(authService.isAuthenticated()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/login'], expect.objectContaining({
      queryParams: expect.objectContaining({ reason: 'session-expired' }),
    }));
  });

  it('adds the bearer token only to API requests and expires the session on 401', () => {
    const { authService, http } = setup();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    signIn(authService, http);
    const client = TestBed.inject(HttpClient);

    client.get(`${apiBaseUrl}/auth/me`).subscribe({ error: () => undefined });
    const request = http.expectOne(`${apiBaseUrl}/auth/me`);
    expect(request.request.headers.get('Authorization')).toBe('Bearer short-lived-test-token');

    client.get('https://third-party.example.test/resource').subscribe();
    const externalRequest = http.expectOne('https://third-party.example.test/resource');
    expect(externalRequest.request.headers.has('Authorization')).toBe(false);
    externalRequest.flush({});

    request.flush({ error: { message: 'expired' } }, { status: 401, statusText: 'Unauthorized' });
    expect(authService.isAuthenticated()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/login'], expect.anything());
    expect(toast.showError).not.toHaveBeenCalled();
  });

  it('toasts only for unreachable-server errors unless a request opts in', () => {
    const { http } = setup();
    const client = TestBed.inject(HttpClient);

    client.get(`${apiBaseUrl}/approvals`).subscribe({ error: () => undefined });
    http.expectOne(`${apiBaseUrl}/approvals`)
      .flush({ error: { message: 'Bad filter' } }, { status: 400, statusText: 'Bad Request' });
    expect(toast.showError).not.toHaveBeenCalled();

    client.get(`${apiBaseUrl}/approvals`, {
      context: new HttpContext().set(SHOW_ERROR_TOAST, true),
    }).subscribe({ error: () => undefined });
    http.expectOne(`${apiBaseUrl}/approvals`)
      .flush({ error: { message: 'Bad filter' } }, { status: 400, statusText: 'Bad Request' });
    expect(toast.showError).toHaveBeenLastCalledWith('Bad filter');

    client.get(`${apiBaseUrl}/health`).subscribe({ error: () => undefined });
    http.expectOne(`${apiBaseUrl}/health`).error(new ProgressEvent('error'));
    expect(toast.showError).toHaveBeenLastCalledWith(
      'Unable to reach the server. Check your connection and try again.',
    );
  });
});
