Auth Module — API & Migration Notes

Overview
- Module: `src/modules/auth`
- Purpose: registration, email verification (OTP), login, logout, password reset
- Security: JWT access tokens, OTPs are stored hashed, tokens expire, JWT_SECRET is required

Environment
- Required:
  - `JWT_SECRET` (string) — must be set in production
  - `JWT_EXPIRES_IN` (optional, default: "1h") — accepted formats like "1h", "15m"

Prisma schema changes applied
- `User` model: added `passwordChangedAt DateTime? @map("password_changed_at")`
- `VerificationToken` model: replaced plaintext `token` column with `tokenHash @map("token_hash")`
  - Plain OTPs are no longer stored in DB; only a bcrypt hash is stored
  - Querying verification now finds recent candidates and compares hashes

DB Migration
1. Review `prisma/schema.prisma` changes (already updated in repo).
2. Generate new Prisma client and apply migration:

```bash
# generate client (already done by me during build)
npm run db:generate

# create and run a migration (develop)
npm run db:migrate
```

Notes: Migration will add the `password_changed_at` column and rename/add `token_hash` column. Review produced SQL before applying to production.

API Endpoints

Prefix: `/auth`

- POST /auth/register
  - Body: `{ email: string, password: string }
  - Response: 200 { message: "User registered. Check your email for OTP." }
  - Notes: creates user (password hashed with bcrypt) and sends a 6-digit OTP to user email.

- POST /auth/verify-email
  - Body: `{ token: string }` (6-digit OTP)
  - Response success: { message, accessToken, user: { id, email, role } }
  - Notes: server searches recent unused verification tokens (type=email_verification) and compares hashes; on success user.isVerified is set true and token marked used.

- POST /auth/resend-otp
  - Body: `{ email: string }`
  - Response: { message: "OTP resent. Check your email." }
  - Notes: invalidates prior unused email verification tokens, creates a new hashed OTP, and emails the plaintext OTP.

- POST /auth/login
  - Body: `{ email?: string, phone?: string, password: string }`
  - Response: { accessToken, isVerified, user }
  - Notes: accepts email or phone as identifier.

- POST /auth/logout
  - Protected by `JwtAuthGuard`
  - Body: none
  - Response: { message: "Logged out successfully", userId }

- POST /auth/request-password-reset
  - Body: `{ email: string }`
  - Response: { message: "Password reset OTP sent." }
  - Notes: creates a hashed OTP of type `password_reset` and emails it.

- POST /auth/reset-password
  - Body: `{ token: string, newPassword: string }`
  - Response: { message: "Password reset successfully." }
  - Notes: finds candidate `password_reset` tokens, compares hashes, updates user's `password` and sets `passwordChangedAt` to current time, marks token used.

Security Improvements Implemented
- JWT: `JWT_SECRET` is required at startup (fail-fast) and `expiresIn` is set via `JWT_EXPIRES_IN` or default `1h`.
- OTPs: plaintext OTPs are no longer stored in DB; only bcrypt hashes are stored in `verification_tokens.token_hash`.
- Password rotation: `passwordChangedAt` is updated on reset; `JwtStrategy` checks `passwordChangedAt` (if present) and invalidates tokens issued before password change.
- Input validation: DTOs use `class-validator`.

Recommended Next Steps (optional)
- Add rate-limiting (e.g., `@nestjs/throttler`) for `/auth/login`, `/auth/verify-email`, `/auth/request-password-reset` endpoints to mitigate brute-force.
- Consider using `argon2` for password hashing (or increase bcrypt rounds to 12+).
- Add audit logs for security-sensitive events (failed login attempts, password resets).
- Add background job to cleanup expired verification tokens.

How I validated
- Ran `npm run db:generate` and `npm run build` to generate Prisma client and compile TypeScript successfully.

If you want, I can now:
- A) Apply a migration SQL and run it against a development DB (`npm run db:migrate`).
- B) Add rate-limiting and increase bcrypt rounds (code changes + package install).
- C) Produce OpenAPI docs (`@nestjs/swagger`) for these endpoints (auto-generate controllers' decorators). 

Which follow-up should I do next? 
