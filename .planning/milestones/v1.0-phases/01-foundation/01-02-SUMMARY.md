---
phase: 01-foundation
plan: 02
subsystem: database
tags: [postgres, drizzle, drizzle-orm, drizzle-kit, docker, docker-compose, zod, bigint, migration]

# Dependency graph
requires:
  - phase: 01-foundation-01
    provides: pnpm workspace monorepo with apps/backend, apps/frontend, packages/shared scaffold
provides:
  - PostgreSQL container via docker-compose.yml (postgres:16-alpine, port 5432, healthcheck)
  - Drizzle schema with all five tables: users, game_logs, game_sessions, daily_bonus_claims, admin_logs
  - Drizzle db instance exported from apps/backend/src/db/index.ts
  - First migration SQL applied — database ready with correct BIGINT column types
  - drizzle.config.ts with fixed dotenv path loading .env from repo root
affects: [02-auth, 03-wallet, 04-games, 05-games, 06-games, 07-games, 08-admin]

# Tech tracking
tech-stack:
  added: []
  patterns: [drizzle pgTable schema definitions, bigint mode:number for monetary columns, dotenv path resolution for monorepo, drizzle pool via pg.Pool]

key-files:
  created:
    - docker-compose.yml
    - apps/backend/src/db/schema.ts
    - apps/backend/src/db/index.ts
    - apps/backend/src/db/migrations/0000_pale_captain_cross.sql
    - apps/backend/src/db/migrations/meta/0000_snapshot.json
    - apps/backend/src/db/migrations/meta/_journal.json
  modified:
    - apps/backend/drizzle.config.ts

key-decisions:
  - "bigint({ mode: 'number' }) for all monetary/counter columns — maps to PostgreSQL BIGINT, avoids precision loss vs integer()"
  - "drizzle.config.ts uses process.cwd() to resolve .env from repo root — drizzle-kit runs from apps/backend/, import.meta not available in CJS bundle mode"
  - "tokenVersion and isBanned added to users table proactively — Phase 2 and Phase 8 need them; cheaper to add now than a migration later"
  - "lastBonusClaimedAt on users row (not just daily_bonus_claims) — O(1) lookup for 24-hour gate vs O(n) join"
  - "balanceAfter on game_logs — Phase 7 balance-over-time chart needs it; reconstructing from joins would be O(n) per user"

patterns-established:
  - "db instance: always query via drizzle db (not raw pool) to get Drizzle BIGINT type mapping"
  - "ESM imports: .js extension on all relative imports in backend (NodeNext moduleResolution)"
  - "drizzle generate then drizzle migrate: generate first to produce SQL, migrate to apply"

requirements-completed: []

# Metrics
duration: 22min
completed: 2026-02-28
---

# Phase 1 Plan 02: Foundation Summary

**PostgreSQL schema via Drizzle ORM with five tables, BIGINT monetary columns, and docker-compose.yml for local Postgres — database ready for Phase 2 auth**

## Performance

- **Duration:** 22 min
- **Started:** 2026-02-28T01:06:23Z
- **Completed:** 2026-02-28T01:28:30Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- `docker-compose.yml` starts postgres:16-alpine on port 5432 with healthcheck — container confirmed healthy via `docker compose ps`
- All five tables created with correct BIGINT columns: balance, total_wagered, total_profit, total_loss, bet_amount, profit, balance_after, amount — verified via `\d users` in psql
- Drizzle `db` instance exported from `apps/backend/src/db/index.ts` using `drizzle({ client: pool, schema })` — full schema types available
- `pnpm db:generate && pnpm db:migrate` runs cleanly from `apps/backend/` directory without manually setting env vars
- TypeScript typecheck passes with zero errors after adding schema and db index

## Task Commits

Each task was committed atomically:

1. **Task 1: Docker Compose, Drizzle schema, and drizzle-kit config** - `731f06f` (feat)
2. **Task 2: Drizzle db instance, env validation, and run migrations** - `e250c68` (feat)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified
- `docker-compose.yml` - postgres:16-alpine with POSTGRES_USER/PASSWORD/DB env vars, healthcheck, volume
- `apps/backend/src/db/schema.ts` - Five pgTable definitions: users (14 cols), game_logs (8 cols), game_sessions (8 cols), daily_bonus_claims (4 cols), admin_logs (6 cols)
- `apps/backend/src/db/index.ts` - Drizzle db instance via pg.Pool, imports env.js and schema.js with .js ESM extensions
- `apps/backend/drizzle.config.ts` - defineConfig pointing at schema.ts and migrations dir; fixed dotenv to load from repo root
- `apps/backend/src/db/migrations/0000_pale_captain_cross.sql` - Generated SQL creating all five tables with FK constraints
- `apps/backend/src/db/migrations/meta/0000_snapshot.json` - Drizzle schema snapshot
- `apps/backend/src/db/migrations/meta/_journal.json` - Migration journal

## Decisions Made
- Used `bigint({ mode: 'number' })` for all monetary/counter columns (not `integer()`) — maps to PostgreSQL BIGINT, per plan specification
- Added `tokenVersion` (integer) and `isBanned` (boolean) to users table proactively — Phase 2 token revocation and Phase 8 admin bans need these; adding now avoids breaking migrations
- Added `lastBonusClaimedAt` to users table — Phase 3 daily bonus gate check is O(1) on the user row vs O(n) join to daily_bonus_claims
- Added `balanceAfter` to game_logs — Phase 7 balance-over-time chart requires this column; historical reconstruction from joins is impractical

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed drizzle.config.ts dotenv path for monorepo layout**
- **Found during:** Task 2 (Drizzle db instance, env validation, and run migrations)
- **Issue:** `pnpm db:migrate` failed with "url: undefined" — `import 'dotenv/config'` looks for `.env` in CWD (`apps/backend/`), but the repo `.env` is at the root. Additionally, `import.meta.dirname` is unavailable because drizzle-kit bundles the config file as CJS internally.
- **Fix:** Replaced `import 'dotenv/config'` with `config({ path: resolve(process.cwd(), '../../.env') })` plus a local fallback `config({ path: resolve(process.cwd(), '.env') })` using named `config` import from dotenv
- **Files modified:** apps/backend/drizzle.config.ts
- **Verification:** `pnpm db:migrate` completes successfully from `apps/backend/` without manual DATABASE_URL env var
- **Committed in:** e250c68 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Fix was necessary for `pnpm db:migrate` to work as documented. The workaround uses `process.cwd()` which is the CWD when drizzle-kit runs — stable in monorepo context. No scope creep.

## Issues Encountered
- Docker Desktop was not running when `docker compose up -d` was attempted. It was launched programmatically via start command and waited ~30 seconds to initialize before retrying. The container then started and reached healthy status within 16 seconds.

## User Setup Required
None — docker-compose.yml is committed. To start the database:
```
docker compose up -d
cd apps/backend && pnpm db:migrate
```
Docker Desktop must be running. The `.env` file at the repo root provides DATABASE_URL.

## Next Phase Readiness
- PostgreSQL database running with all five tables — ready for Phase 2 auth queries
- Drizzle `db` import available for Express route handlers in auth/wallet/games phases
- `pnpm db:generate` + `pnpm db:migrate` workflow established for schema changes
- TypeScript typecheck clean across all packages
- No blockers for Phase 2 (Auth)

## Self-Check: PASSED

- `docker-compose.yml` verified on disk
- `apps/backend/src/db/schema.ts` verified on disk (9 bigint columns)
- `apps/backend/src/db/index.ts` verified on disk (exports db)
- `apps/backend/drizzle.config.ts` verified on disk (updated dotenv path)
- `apps/backend/src/db/migrations/0000_pale_captain_cross.sql` verified on disk
- Task commits `731f06f` and `e250c68` verified in git log
- `docker compose ps` shows postgres healthy
- `\d users` shows balance, total_wagered, total_profit, total_loss as bigint
- `pnpm --filter backend typecheck` exits 0

---
*Phase: 01-foundation*
*Completed: 2026-02-28*
