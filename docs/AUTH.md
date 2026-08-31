# Authentication

## Flow

1. Client sends `POST /api/auth/request-otp` with an Iranian mobile number.
2. API normalizes the number to `+98...`, rate-limits requests in Redis, generates a 6-digit OTP, and stores only an HMAC digest for five minutes.
3. Client sends `POST /api/auth/verify-otp` with the phone and code.
4. API creates the user on first successful verification and returns an access/refresh token pair.
5. Access tokens are short-lived (15 minutes). Refresh tokens are rotated on every refresh and backed by a revocable Redis session (30 days).
6. `POST /api/auth/logout` revokes the active refresh session.

## Roles

Supported roles:
- `CUSTOMER`
- `COURIER`
- `ADMIN`

New phone-authenticated users always start as `CUSTOMER`. Courier/admin elevation must happen through a trusted administrative workflow; clients cannot choose their own role during sign-in.

`JwtAuthGuard` validates access tokens and verifies the current user is still active in PostgreSQL. `RolesGuard` plus `@Roles(...)` provides endpoint-level RBAC for future courier/admin modules.

## OTP abuse controls

- 60-second cooldown between sends per phone fingerprint
- maximum 5 sends per hour per phone fingerprint
- maximum 5 verification attempts per OTP window
- OTP lifetime: 5 minutes
- raw phone numbers are not used in OTP Redis keys
- raw OTP codes are not stored in Redis

## SMS provider

The initial provider is a development-only console adapter. It refuses to send when `NODE_ENV=production`. A production Iranian SMS provider will replace it behind the same `SmsProvider` contract without changing the auth domain flow.

`DEV_OTP_CODE` can make development and CI deterministic. Do not set it in production.

## Required secrets

Production must provide independent high-entropy values for:
- `OTP_SECRET`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`

Never commit production values to the repository.
