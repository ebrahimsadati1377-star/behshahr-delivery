export type AppRole = 'CUSTOMER' | 'COURIER' | 'ADMIN';

export interface AccessTokenPayload {
  sub: string;
  role: AppRole;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  role: AppRole;
  type: 'refresh';
  jti: string;
}

export interface AuthenticatedUser {
  id: string;
  phone: string;
  role: AppRole;
}
