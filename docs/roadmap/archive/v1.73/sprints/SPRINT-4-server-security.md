# Sprint 4 — Server & Security Hardening

> Issues identified by Server and Security agents (2026-04-12).
> These items require a dedicated security review pass.

## CRITICAL Priority

### 4.1 — Audit all API routes for input validation

**Severity:** CRITICAL
**Directory:** `apps/server/src/routes/`

**Action:** Systematically check every route handler for:
- Missing Zod/schema validation on request body
- Missing parameter sanitization
- SQL injection vectors (string concatenation in Prisma raw queries)
- Missing authorization checks (is the requesting user allowed to access this resource?)

**Files to audit:**
- `apps/server/src/routes/match.ts` — match creation, state updates, move submission
- `apps/server/src/routes/team.ts` — team CRUD operations
- `apps/server/src/routes/auth.ts` — registration, login
- `apps/server/src/routes/leaderboard.ts` — public data access
- `apps/server/src/routes/admin.ts` — admin operations (highest risk)

---

### 4.2 — WebSocket authentication validation

**Severity:** CRITICAL
**File:** `apps/server/src/index.ts`

**Action:** Verify that:
- All WebSocket connections require valid auth tokens
- Match tokens are validated before allowing game actions
- Token expiration is enforced
- Connection rate limiting is in place

---

### 4.3 — Audit for hardcoded secrets

**Severity:** CRITICAL
**Files:** All source files, docker-compose files, .env files

**Action:**
- Search for hardcoded API keys, JWT secrets, database passwords
- Check `docker-compose.yml`, `docker-compose.prod.yml` for exposed credentials
- Verify `.env` files are in `.gitignore`
- Run `pnpm audit` for known dependency vulnerabilities

---

## HIGH Priority

### 4.4 — Rate limiting on all endpoints

**Severity:** HIGH
**Directory:** `apps/server/src/middleware/`

**Action:** Verify rate limiting is configured for:
- Authentication endpoints (brute force protection)
- Game move submission (spam protection)
- Registration endpoint (account creation abuse)
- API endpoints generally

---

### 4.5 — Game state synchronization bugs

**Severity:** HIGH
**Files:**
- `apps/server/src/game-rooms.ts`
- `apps/server/src/game-resync.ts`
- `apps/server/src/game-actions.ts`

**Action:** Audit for:
- Race conditions when two clients submit moves simultaneously
- State corruption when a client disconnects mid-action
- Missing transaction boundaries for state updates
- Verify resync logic correctly handles all edge cases

---

### 4.6 — WebSocket memory leak on disconnect

**Severity:** HIGH
**File:** `apps/server/src/game-rooms.ts`

**Action:** Verify that:
- All event listeners are cleaned up on player disconnect
- Room references are removed when both players leave
- Timers (turn timer, forfeit timer) are cleared on disconnect
- No orphaned socket references remain in memory

---

### 4.7 — CSRF protection

**Severity:** HIGH
**File:** `apps/server/src/middleware/`

**Action:** Verify CSRF protection is enabled for state-changing operations (POST, PUT, DELETE). JWT-based auth provides some protection but stateless tokens need additional CSRF mitigation.

---

### 4.8 — Error message information leakage

**Severity:** HIGH
**Directory:** `apps/server/src/routes/`

**Action:** Audit all error responses for:
- Stack traces exposed to client
- Database error messages exposed
- Internal paths or configuration leaked
- User enumeration via different error messages (auth)

---

## MEDIUM Priority

### 4.9 — Server-side match.ts pre-existing TypeScript errors

**Severity:** MEDIUM
**File:** `apps/server/src/routes/match.ts:947,1014`

**Problem:** `makeRNG` is referenced but not imported/defined. These are pre-existing compilation errors.

**Fix:** Import `makeRNG` from `@bb/game-engine` or define it locally.

---

### 4.10 — Implicit any types in server routes

**Severity:** MEDIUM
**Files:**
- `apps/server/src/routes/leaderboard.ts:35`
- `apps/server/src/routes/team.ts:1881,1887,1911`

**Problem:** Parameters with implicit `any` type. Reduces type safety.

**Fix:** Add explicit types to all parameters.

---

### 4.11 — Database query optimization

**Severity:** MEDIUM
**Directory:** `apps/server/src/routes/`, `apps/server/src/prisma-sqlite-client/`

**Action:** Audit for:
- N+1 queries (loading related data in loops)
- Missing pagination on list endpoints
- Unbounded queries (no LIMIT)
- Missing database indexes for frequently queried fields

---

### 4.12 — Spectator mode authorization

**Severity:** MEDIUM
**File:** `apps/server/src/game-spectator.ts`

**Action:** Verify that spectators:
- Cannot submit moves
- Cannot access private game data (hand, undiscovered info)
- Cannot interfere with game state
- Rate limiting on spectator connections

---

## LOW Priority

### 4.13 — Docker security

**Severity:** LOW
**Files:** `Dockerfile.server`, `Dockerfile.web`, `docker-compose.prod.yml`

**Action:**
- Verify containers run as non-root user
- Check for unnecessary exposed ports
- Verify secrets are not baked into images
- Check base image versions for vulnerabilities

---

### 4.14 — Dependency audit

**Severity:** LOW
**File:** `pnpm-lock.yaml`

**Action:** Run `pnpm audit` and address any HIGH/CRITICAL vulnerabilities. Update outdated dependencies.

---

## Checklist

- [ ] 4.1 — API route input validation audit
- [ ] 4.2 — WebSocket authentication
- [ ] 4.3 — Hardcoded secrets scan
- [ ] 4.4 — Rate limiting verification
- [ ] 4.5 — State sync race conditions
- [ ] 4.6 — WebSocket memory leak audit
- [ ] 4.7 — CSRF protection
- [ ] 4.8 — Error message leakage
- [ ] 4.9 — match.ts makeRNG import
- [ ] 4.10 — Implicit any types
- [ ] 4.11 — Database query optimization
- [ ] 4.12 — Spectator authorization
- [ ] 4.13 — Docker security
- [ ] 4.14 — Dependency audit
