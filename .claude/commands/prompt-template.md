---
description: Load a prompt template, fill in variables, and execute it. Combines template resolution with ECC-optimized execution.
allowed_tools: ["Bash", "Read", "Write", "Edit", "Grep", "Glob", "Agent", "AskUserQuestion", "TodoWrite"]
---

# /prompt-template

Load, resolve, and execute a prompt template.

## Your Task

Apply the **prompt-template** skill to the user's input. Follow the 5-phase
execution pipeline:

### Phase 1: Template Loading

Identify the template source from the user's input:

1. **Inline**: Template pasted directly in the message
2. **File path**: Read the template from the given `.md` or `.txt` file
3. **Skill reference**: Load an existing skill's SKILL.md as the base template
4. **Templates directory**: Check `.claude/templates/` for named templates

If no template is found, list available templates from `.claude/templates/`
(if any exist) and ask the user to provide one.

### Phase 2: Variable Resolution

1. **Detect variables**: Find all `${VARIABLE_NAME}` placeholders in the template
2. **Auto-resolve built-ins**: Detect project context for built-in variables:
   - `${PROJECT_NAME}` — from package.json, go.mod, or directory name
   - `${TECH_STACK}` — from project config files
   - `${LANGUAGE}` — from file extensions
   - `${TEST_FRAMEWORK}` — from test config (vitest, jest, pytest, etc.)
   - `${PACKAGE_MANAGER}` — npm, yarn, pnpm, pip, cargo, etc.
   - `${SRC_DIR}` — main source directory
   - `${TEST_DIR}` — test directory
3. **Check user input**: Extract variable values provided in the user's message
4. **Ask for missing**: Use AskUserQuestion for any unresolved custom variables
5. **Substitute**: Replace all placeholders with resolved values

Display the resolved prompt to the user before proceeding.

### Phase 3: ECC Optimization

Analyze the resolved prompt and select execution components:

- **Task type**: new feature, bug fix, refactor, test, docs, infra
- **Complexity**: TRIVIAL / LOW / MEDIUM / HIGH / EPIC
- **Agents**: planner (if >= MEDIUM), tdd-guide (if code), code-reviewer (after code)
- **Skills**: Match relevant skills (coding-standards, backend-patterns, etc.)
- **Model**: Haiku (TRIVIAL), Sonnet (LOW-MEDIUM), Opus (HIGH-EPIC)

### Phase 4: Execute

Run the resolved prompt as a task:

1. If HIGH/EPIC complexity, use planner agent first
2. Follow TDD when the task involves code changes
3. Implement the requested changes
4. Run code-reviewer agent on all modified code
5. Run tests if applicable

### Phase 5: Summary

Report:
- Changes made (files created/modified)
- Variables used and their resolved values
- ECC components leveraged
- If template was inline, suggest saving to `.claude/templates/`

## CRITICAL

- DO resolve variables before executing
- DO show the resolved prompt to the user before Phase 4
- DO execute the task (unlike /prompt-optimize which is advisory only)
- DO NOT skip variable resolution
- DO NOT change the user's intent — only enhance execution strategy

## User Input

$ARGUMENTS
