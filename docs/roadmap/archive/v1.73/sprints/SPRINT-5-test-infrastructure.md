# Sprint 5 — Test Infrastructure & Tech Debt

> Infrastructure issues and tech debt found during analysis (2026-04-12).

## HIGH Priority

### 5.1 — Fix vitest configuration for root-level test runner

**Severity:** HIGH
**File:** `tests/integration/vitest.config.ts`

**Problem:** Running vitest from the project root with the integration config fails because `setupFiles: ["./setup.ts"]` resolves to the project root (missing), not `tests/integration/setup.ts`. Tests only pass when run from `tests/integration/` directory.

**Fix:** Use absolute path in config:
```typescript
setupFiles: [path.resolve(__dirname, "setup.ts")],
```
Or add a root-level vitest config that delegates to workspace configs.

---

### 5.2 — 72 test files fail with "document is not defined"

**Severity:** HIGH
**Config:** Missing `jsdom` environment for browser-dependent tests

**Problem:** Tests using `@testing-library/react`, React hooks, or DOM APIs fail because vitest runs in `node` environment. The test files need `// @vitest-environment jsdom` or a workspace config with `environment: "jsdom"`.

**Fix:** Add per-workspace vitest configs:
```typescript
// packages/ui/vitest.config.ts
export default defineConfig({
  test: { environment: "jsdom" }
});
```

---

### 5.3 — Missing vitest dependency in some workspaces

**Severity:** HIGH
**Files:** `apps/server/src/*.test.ts`

**Problem:** Server test files import from `vitest` but it's not in `apps/server/package.json` dependencies. TypeScript reports: `Cannot find module 'vitest'`.

**Fix:** Add `vitest` as a dev dependency to `apps/server/package.json` or configure a workspace-level shared vitest.

---

## MEDIUM Priority

### 5.4 — Pre-existing TypeScript errors across packages

**Severity:** MEDIUM

**Known errors:**
- `apps/server/src/routes/match.ts:947,1014` — `makeRNG` not defined
- `apps/server/src/routes/leaderboard.ts:35` — implicit `any`
- `apps/server/src/routes/team.ts:1881,1887,1911` — implicit `any`
- `apps/web/app/components/PreMatchSummary.test.tsx:7` — incomplete mock type

**Fix:** Address each type error. Add `strict: true` enforcement across all tsconfigs.

---

### 5.5 — Test coverage below 80% target

**Severity:** MEDIUM

**Problem:** While 3457 tests pass, many critical game engine paths (blocking, injury, ball mechanics) lack dedicated test coverage for edge cases found in this analysis.

**Suggested new tests:**
- Armor roll notification uses 2D6 (regression test for Sprint 1 fix)
- Block dice single-RNG (regression test for Sprint 1 fix)
- Wrestle + ball carrier → turnover
- bounceBall with max depth guard
- isPositionOccupied with dugout players
- handlePushBack single-direction follow-up choice
- InducementsPhaseUI submission with both teams ready

---

### 5.6 — Empty Python scripts in project root

**Severity:** LOW
**Files:**
- `extract_dice_faces.py` (1 byte)
- `extract_star_players.py` (1 byte)
- `extract_star_players_simple.py` (1 byte)
- `generate_typescript.py` (1 byte)
- `rename_dice_faces.py` (1 byte)
- `update-player-positions.js` (1 byte)
- `update-player-skills.js` (1 byte)
- `verify-skills.js` (1 byte)

**Problem:** 8 empty scripts cluttering the project root. Likely one-time migration scripts that were emptied after use.

**Fix:** Delete them or move to a `scripts/archive/` directory.

---

### 5.7 — Excessive markdown documentation files in project root

**Severity:** LOW

**Problem:** 30+ markdown files in the project root (STAR-PLAYERS-*.md, DICE-*.md, etc.) that appear to be development notes, not user-facing documentation.

**Fix:** Move to `docs/dev-notes/` to declutter the root.

---

## Checklist

- [ ] 5.1 — Fix vitest root config
- [ ] 5.2 — Add jsdom environment for UI tests
- [ ] 5.3 — Add vitest dependency to server
- [ ] 5.4 — Fix pre-existing TypeScript errors
- [ ] 5.5 — Add regression tests for Sprint 1 fixes
- [ ] 5.6 — Clean up empty scripts
- [ ] 5.7 — Move dev notes to docs/
