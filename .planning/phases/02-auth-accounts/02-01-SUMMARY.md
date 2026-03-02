---
phase: 02-auth-accounts
plan: 01
subsystem: backend-auth
tags: [auth, registration, email-verification, drizzle, jwt, nodemailer, bcrypt]
dependency_graph:
  requires: [01-foundation]
  provides: [auth-schema, token-service, email-service, auth-service, validate-middleware, rate-limiter, register-endpoint, verify-email-endpoint]
  affects: [02-02-login-jwt, 02-03-logout-reset]
tech_stack:
  added: [jose, bcryptjs, cookie-parser, express-rate-limit, nodemailer, axios]
  patterns: [opaque-refresh-tokens, sha256-token-hashing, bcrypt-timing-attack-prevention, email-enumeration-prevention, zod-validation-middleware]
key_files:
  created:
    - apps/backend/src/services/tokenService.ts
    - apps/backend/src/services/emailService.ts
    - apps/backend/src/services/authService.ts
    - apps/backend/src/middleware/validate.ts
    - apps/backend/src/middleware/rateLimiter.ts
    - apps/backend/src/routes/auth.ts
    - apps/backend/src/types/express.d.ts
    - apps/backend/src/db/migrations/0001_unusual_wrecking_crew.sql
  modified:
    - apps/backend/src/db/schema.ts
    - apps/backend/src/env.ts
    - apps/backend/src/app.ts
    - .env.example
decisions:
  - "Always return HTTP 201 for POST /register regardless of duplicate email — prevents email enumeration"
  - "bcrypt timing-attack prevention: hash a dummy string before throwing DUPLICATE_EMAIL error"
  - "Store only SHA-256 hash of opaque tokens in DB — raw token never persisted"
  - "isEmailVerified defaults to false — account activation requires clicking verification link"
  - "Username auto-derived from email prefix + 5-char random alphanumeric suffix — no client input"
  - "email_verification_tokens.used_at marks single-use — row kept for audit trail, not deleted"
  - "Migration deferred: Docker Desktop must be running before db:migrate can execute"
metrics:
  duration: 3 min
  completed: 2026-03-02
  tasks_completed: 2
  files_changed: 11
---

# Phase 2 Plan 01: Auth Infrastructure — Registration + Email Verification Summary

**One-liner:** JWT + bcrypt auth foundation with opaque email-verification tokens, Nodemailer/Mailtrap SMTP relay, and email-enumeration-safe registration endpoint.

## What Was Built

Full authentication infrastructure layer required by Plans 02 and 03:

- **Schema extended**: `is_email_verified` column on `users`, two new tables (`refresh_tokens`, `email_verification_tokens`) with SHA-256 hashed token storage
- **Migration generated**: `0001_unusual_wrecking_crew.sql` — ready to run once Docker Desktop is started
- **env.ts extended**: Validates `JWT_SECRET` (min 32 chars), `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `FRONTEND_URL` — startup crashes with clear error if any missing
- **tokenService**: `generateOpaqueToken` (32 random bytes → 64 hex chars), `hashToken` (SHA-256), `signAccessToken` (HS256 JWT, 15m expiry), `verifyAccessToken`
- **emailService**: Nodemailer transporter with SMTP env config, `sendVerificationEmail`, `sendPasswordResetEmail`
- **authService**: `register` (bcrypt cost 12, username derivation, verification token issuance) and `verifyEmail` (single-use enforcement via `used_at`)
- **validate middleware**: Reusable Zod schema validation for request bodies
- **rateLimiter middleware**: 10 requests/15 min window, skips successful requests
- **auth routes**: `POST /api/auth/register` + `GET /api/auth/verify-email`
- **app.ts**: cookie-parser added, authRouter mounted at `/api/auth`
- **express.d.ts**: `req.user?: { id: number }` type augmentation for future JWT middleware

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Infrastructure Note

**Docker Desktop was not running during execution.** The Drizzle migration SQL was generated successfully (`0001_unusual_wrecking_crew.sql`) but could not be applied to the database. Run `docker compose up -d && pnpm --filter backend db:migrate` from the repo root before starting the backend server.

## Verification Results

- `pnpm --filter backend typecheck`: PASSED (zero errors) — confirmed twice
- Migration SQL: Generated correctly — adds `is_email_verified` to `users`, creates `refresh_tokens` and `email_verification_tokens` tables with FK constraints
- Migration apply: PENDING — requires Docker Desktop to be running

## Self-Check: PASSED

All 12 key files verified present on disk. Both task commits (31d00b9, ec447e2) confirmed in git history. TypeScript typecheck passes with zero errors.
