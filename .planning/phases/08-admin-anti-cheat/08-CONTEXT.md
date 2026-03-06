# Phase 8: Admin & Anti-Cheat - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Role-gated admin panel at `/admin/*` — dashboard stats, player search/inspector, ban controls, and audit log. Server-side anti-cheat — rate limiting on game endpoints, server-side bet validation, and click interval detection. Admin panel is operator/developer-facing, not public. All eight requirements (ADMIN-01..05, ANTI-01..03) are delivered in this phase.

</domain>

<decisions>
## Implementation Decisions

### Rate limiting (ANTI-01)
- Apply `gameLimiter` to all `POST /api/games/*` endpoints only
- Auth routes keep the existing `authLimiter` (no change)
- Read-only routes (leaderboard, profile, GET endpoints) stay unlimited
- Limit: **30 requests per minute per IP** using express-rate-limit (already installed)
- IP-based — not per user-ID; covers unauthenticated abuse and pre-auth scripting

### Admin panel visual style
- Matches the existing dark casino theme: `#0f0f1a` page bg, `#1a1a2e` panel bg, `#7c3aed` accent, `#e0d7ff` headings
- Inline styles only — same pattern as all other pages (no CSS modules, no Tailwind)
- Functional utility layout: tables, search inputs, action buttons — no decorative game elements

### Player history in admin inspector (ADMIN-03)
- Show **last 50 game rounds** ordered by most recent first
- No pagination — single query, simple display
- Columns: timestamp, game type, bet amount, outcome, profit

### Ban behavior (ADMIN-04)
- Ban mechanism: increment `tokenVersion` + set `isBanned = true` (schema already supports this — established in Phase 2)
- Banned user's next API call returns generic 401 — same as session expired, no "account banned" message
- Frontend shows generic session-expired flow and redirects to login; login then rejects them (isBanned check already in auth route)
- No new error code or UI state needed on the frontend

### Admin authentication (ADMIN-01)
- Admins use the same login form as regular users
- `requireAdmin` middleware: verifies JWT (via requireAuth) + queries DB for `role = 'admin'` on every admin request
- JWT role claim is NOT trusted — DB is the source of truth per ADMIN-01

### Audit log (ADMIN-05)
- Every admin action writes to existing `admin_logs` table (adminId, action, targetUserId, details, createdAt)
- Actions to log: ban, unban, balance reset, player lookup (search)
- `details` column stores free-text context (e.g. "banned via admin panel")

### Claude's Discretion
- Click interval detection implementation (in-memory per-IP timestamp tracking, exact threshold for "inhuman speed" — ANTI-03)
- Exact server-side validation per game type (ANTI-02 — per-game param validation beyond the existing validateBet middleware)
- Admin dashboard stat query design (count queries, coin circulation sum)
- Admin route guard on the frontend (ProtectedRoute variant that also checks admin role)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `rateLimiter.ts`: `authLimiter` already uses express-rate-limit — add `gameLimiter` to same file, apply to gamesRouter
- `requireAuth.ts`: base JWT middleware — `requireAdmin` extends it by adding a DB `role` check after JWT verification
- `ProtectedRoute.tsx`: existing route guard — admin routes need a variant that also checks admin role (or a separate `AdminRoute` component)
- `validateBet.ts`: existing zod-based bet validation — per-game ANTI-02 validation builds on this pattern
- `adminLogs` table: already in schema with correct shape — no migration needed
- `users` table: `isBanned`, `tokenVersion`, `role` columns all exist — ban mechanism requires no schema changes
- `apiClient` + `useState` pattern from ProfilePage: same pattern for admin data fetching

### Established Patterns
- Dark theme: `#0f0f1a` bg, `#1a1a2e` panels, `#7c3aed` accent, `#e0d7ff` headings, `#a0a0c0` secondary text
- Inline styles only throughout — no CSS modules
- Page structure: `<div style={{ minHeight: '100vh', backgroundColor: '#0f0f1a' }}>` → `<Header />` → `<main style={{ maxWidth: '...' }}>`
- Service layer pattern: `adminService.ts` alongside existing `authService.ts`, `walletService.ts` etc.
- Routes registered in `app.ts` at `/api/admin`

### Integration Points
- `app.ts`: register `adminRouter` at `/api/admin` with `requireAdmin` applied to the router
- `rateLimiter.ts`: add `gameLimiter` export; import and apply in `routes/games.ts`
- `App.tsx`: add `/admin` route with admin-role guard (AdminRoute or extended ProtectedRoute)
- `Header.tsx`: no change needed — admin panel is accessed directly at `/admin`, not via main nav

</code_context>

<specifics>
## Specific Ideas

- No specific visual references — standard dark utility panel consistent with existing aesthetic
- Admin panel not linked from main nav — operator accesses it by navigating directly to `/admin`

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 08-admin-anti-cheat*
*Context gathered: 2026-03-05*
