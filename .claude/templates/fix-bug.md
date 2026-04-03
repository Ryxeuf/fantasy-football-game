# Template: fix-bug

## Description
Diagnose and fix a bug with a regression test to prevent recurrence.

## Variables
- ${BUG_DESCRIPTION}: Description of the bug and how to reproduce it
- ${AFFECTED_AREA}: Part of the codebase affected (e.g., "game-engine", "server", "web")

## Prompt
Fix the following bug in the ${AFFECTED_AREA} area: ${BUG_DESCRIPTION}

Project: ${PROJECT_NAME}
Tech stack: ${TECH_STACK}

Steps:
1. Reproduce the issue and identify root cause
2. Write a regression test that fails with the current bug
3. Apply the minimal fix
4. Verify the regression test passes
5. Run existing tests to ensure no regressions
