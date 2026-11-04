export type UserRole = 'APPLICANT' | 'APPROVER' | 'ADMIN' | 'DISPATCH_OFFICER';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  tokenType: 'Bearer';
  expiresInSeconds: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegistrationRequest extends LoginRequest {
  name: string;
}
