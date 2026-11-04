import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';
import { AuthResponse } from './auth.models';

describe('AuthService', () => {
  let authService: AuthService;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    authService = TestBed.inject(AuthService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('keeps the access token in memory and clears it on logout', () => {
    const response: AuthResponse = {
      user: {
        id: 'user-id',
        name: 'Fictional Applicant',
        email: 'applicant@example.test',
        role: 'APPLICANT',
      },
      accessToken: 'short-lived-test-token',
      tokenType: 'Bearer',
      expiresInSeconds: 900,
    };

    authService.login({
      email: response.user.email,
      password: 'a-safe-test-password-2026',
    }).subscribe();
    const loginRequest = httpTestingController.expectOne(
      'http://localhost:3000/api/auth/login',
    );
    expect(loginRequest.request.headers.has('Authorization')).toBe(false);
    loginRequest.flush(response);

    expect(authService.accessToken).toBe(response.accessToken);
    expect(authService.currentUser()).toEqual(response.user);
    expect(authService.isAuthenticated()).toBe(true);

    authService.logout();
    expect(authService.accessToken).toBeNull();
    expect(authService.currentUser()).toBeNull();
    expect(authService.isAuthenticated()).toBe(false);
  });

  it('adds the bearer token to subsequent API requests', () => {
    const response: AuthResponse = {
      user: {
        id: 'user-id',
        name: 'Fictional Applicant',
        email: 'applicant@example.test',
        role: 'APPLICANT',
      },
      accessToken: 'short-lived-test-token',
      tokenType: 'Bearer',
      expiresInSeconds: 900,
    };

    authService.login({
      email: response.user.email,
      password: 'a-safe-test-password-2026',
    }).subscribe();
    httpTestingController.expectOne('http://localhost:3000/api/auth/login').flush(response);

    TestBed.inject(HttpClient).get('http://localhost:3000/api/auth/me').subscribe();
    const request = httpTestingController.expectOne(
      'http://localhost:3000/api/auth/me',
    );
    expect(request.request.headers.get('Authorization')).toBe(
      'Bearer short-lived-test-token',
    );
    request.flush({ user: response.user });

    TestBed.inject(HttpClient).get('https://third-party.example.test/resource').subscribe();
    const externalRequest = httpTestingController.expectOne(
      'https://third-party.example.test/resource',
    );
    expect(externalRequest.request.headers.has('Authorization')).toBe(false);
    externalRequest.flush({});
  });
});
