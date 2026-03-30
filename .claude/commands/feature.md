---
description: Implement a fullstack feature end-to-end across the monorepo (web, server, game-engine, prisma, mobile). Plans, scaffolds, implements with TDD, and reviews.
---

# Feature Command

Implement a fullstack feature across the Nuffle Arena monorepo using a structured pipeline.

## Input

$ARGUMENTS

## Step 1: Understand & Plan

1. **Restate the feature** in clear terms — what it does, who it's for, which layers it touches
2. **Identify affected packages** among:
   - `prisma/` — schema changes, migrations
   - `packages/game-engine/` — game logic
   - `apps/server/` — API routes, services, validation
   - `apps/web/` — pages, components, hooks
   - `apps/mobile/` — screens, native components
   - `packages/ui/` — shared UI components
3. **List dependencies** between layers (e.g. "API must exist before frontend can call it")
4. **Surface risks** — breaking changes, migration concerns, performance impact
5. **Present the plan** with phases and WAIT for user confirmation before coding

## Step 2: Database & Schema (if needed)

1. Update `prisma/schema.prisma` with new models/fields
2. Generate migration: `pnpm prisma migrate dev --name <descriptive_name>`
3. Regenerate client: `pnpm prisma generate`
4. Validate schema compiles: `pnpm prisma validate`

## Step 3: Game Engine (if needed)

1. Add types/interfaces in `packages/game-engine/src/`
2. Write failing tests in `tests/game-engine/`
3. Implement logic — pure functions, no side effects
4. Run tests: `pnpm turbo test --filter=game-engine`
5. Verify all tests pass before moving on

## Step 4: Backend API

1. Define Zod validation schemas for request/response
2. Write integration tests in `tests/integration/`
3. Implement Express routes and service layer in `apps/server/`
4. Run tests: `pnpm turbo test --filter=server`
5. Verify endpoints work with correct status codes and error handling

## Step 5: Frontend Web

1. Create/update pages and components in `apps/web/`
2. Add shared UI components to `packages/ui/` if reusable
3. Write component tests in `tests/ui/`
4. Run tests: `pnpm turbo test --filter=web`
5. Verify the feature renders and behaves correctly

## Step 6: Mobile (if needed)

1. Create/update screens in `apps/mobile/`
2. Reuse shared components from `packages/ui/` where possible
3. Verify mobile-specific concerns (touch, navigation, secure store)

## Step 7: Verify Fullstack

1. Run full build: `pnpm turbo build`
2. Run all tests: `pnpm turbo test`
3. Check test coverage meets 80% minimum
4. Verify no lint errors: `pnpm turbo lint`

## Step 8: Code Review

Use the **code-reviewer** agent to review all changes:
- Security: no hardcoded secrets, inputs validated, SQL injection prevention
- Quality: small functions, proper error handling, immutable patterns
- Tests: coverage >= 80%, edge cases covered
- Performance: no N+1 queries, proper pagination

## Guardrails

- **WAIT for user confirmation** after the plan (Step 1) before writing any code
- **TDD mandatory**: write tests before implementation at every layer
- **One layer at a time**: don't jump to frontend before backend is tested
- **Stop and ask** if:
  - The feature requires breaking changes to existing APIs
  - Schema migration could cause data loss
  - The scope expands beyond what was originally described
  - A dependency is missing and needs installation

## Integration with Other Commands

- `/plan` — if you need deeper architectural analysis first
- `/tdd` — for focused TDD on a single component
- `/build-fix` — if build errors occur during implementation
- `/code-review` — automatically invoked in Step 8
- `/test-coverage` — to verify coverage thresholds
- `/prisma-database-agent` — for complex schema design
- `/game-state-integration-agent` — for game state pipeline changes
