---
description: Diagnose and fix a bug on the site. Reproduces the issue, identifies root cause, writes a regression test, applies minimal fix, and verifies.
---

# Fix Command

Diagnose and fix a bug with a structured reproduce-then-fix workflow.

## Input

$ARGUMENTS

## Step 1: Understand the Bug

1. **Restate the bug** — what's the expected behavior vs actual behavior?
2. **Identify the scope** — which layer is affected?
   - `apps/web/` — UI rendering, client-side logic, styling
   - `apps/server/` — API responses, validation, auth
   - `packages/game-engine/` — game rules, calculations
   - `prisma/` — data integrity, queries
   - `apps/mobile/` — mobile-specific issues
3. **Check for related issues** — search the codebase for similar patterns

## Step 2: Locate the Root Cause

1. **Search for relevant code** using Grep/Glob across the monorepo
2. **Read the suspect files** — understand the current logic
3. **Trace the data flow** — follow the bug from input to output:
   - Frontend: component → hook → API call
   - Backend: route → service → database query
   - Game engine: action → validation → state update
4. **Identify the root cause** — explain clearly what's wrong and why

## Step 3: Write a Regression Test (RED)

1. Write a test that **reproduces the bug** — it must FAIL with current code
2. Place the test in the correct location:
   - Game logic: `tests/game-engine/`
   - API: `tests/integration/`
   - UI: `tests/ui/`
3. Run the test and confirm it fails: `pnpm turbo test --filter=<package>`
4. The failing test proves the bug exists

## Step 4: Apply Minimal Fix (GREEN)

1. Make the **smallest change** that fixes the root cause
2. Prefer fixing the root cause over patching symptoms
3. Do NOT refactor surrounding code — fix only the bug
4. Do NOT add unrelated improvements
5. Run the regression test and confirm it passes

## Step 5: Verify No Regressions

1. Run the full test suite for the affected package: `pnpm turbo test --filter=<package>`
2. Run the build: `pnpm turbo build`
3. If other tests break, the fix has side effects — investigate before proceeding
4. Run lint: `pnpm turbo lint`

## Step 6: Code Review

Use the **code-reviewer** agent on the diff:
- Verify the fix addresses the root cause, not just symptoms
- Check for edge cases the fix might miss
- Ensure no security regressions
- Confirm test coverage is adequate

## Step 7: Summary

Report:
- **Root cause**: what was wrong and why
- **Fix applied**: what was changed (file paths and line numbers)
- **Regression test**: what test was added to prevent recurrence
- **Side effects**: any other areas affected by the change

## Guardrails

- **Test first**: always write the regression test BEFORE applying the fix
- **Minimal diff**: change only what's necessary — no cleanup, no refactoring
- **Stop and ask** if:
  - The bug is in multiple layers and requires coordinated changes
  - The fix requires a schema migration
  - The root cause is unclear after investigation
  - Fixing the bug would break existing functionality
  - The bug is actually a missing feature, not a defect

## Common Bug Patterns

| Symptom | Likely Cause | Where to Look |
|---------|-------------|---------------|
| Page crashes / white screen | Unhandled null/undefined | `apps/web/` components |
| API returns 500 | Unhandled error in service | `apps/server/src/` |
| Wrong game calculation | Logic error in engine | `packages/game-engine/src/` |
| Data not saving | Prisma query issue | `apps/server/` + `prisma/` |
| Stale UI after action | Missing state update | `apps/web/` hooks/stores |
| Auth failures | Token/session issue | `apps/server/` middleware |
| Mobile crash | Platform-specific bug | `apps/mobile/` |

## Integration with Other Commands

- `/build-fix` — if the fix introduces build errors
- `/tdd` — for complex fixes needing multiple test cases
- `/test-coverage` — to verify coverage after fix
- `/code-review` — automatically invoked in Step 6
