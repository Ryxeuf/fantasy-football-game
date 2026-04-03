---
name: prompt-template
description: >-
  Load a prompt template, fill in variables, optimize it with ECC components,
  and execute the resulting prompt. Combines prompt-optimizer analysis with
  actual task execution.
  TRIGGER when: user says "use prompt template", "execute template",
  "run this template", "fill and run prompt", "prompt template",
  or explicitly invokes /prompt-template.
  Also triggers on French: "utiliser le template de prompt",
  "executer le template", "remplir et lancer le prompt".
  DO NOT TRIGGER when: user only wants advisory prompt optimization
  (use prompt-optimizer instead).
origin: project
metadata:
  author: project
  version: "1.0.0"
---

# Prompt Template Skill

Load a prompt template, resolve its variables, optimize with ECC ecosystem
components, and execute the fully resolved prompt in a single workflow.

## When to Use

- User provides a prompt template with placeholders and wants it executed
- User says "use prompt template", "run this template", "fill and execute"
- User says "utiliser le template", "executer le template de prompt"
- User wants to reuse a saved prompt pattern for a specific task
- User invokes `/prompt-template`

### Do Not Use When

- User only wants prompt analysis without execution (use `prompt-optimizer`)
- User wants to create a new skill from patterns (use `skill-create`)
- User is writing code directly without a template

## How It Works

### Phase 1: Template Loading

Identify the prompt template from one of these sources:

| Source | Detection |
|--------|-----------|
| **Inline** | User pastes template directly in the message |
| **File path** | User provides a path to a `.md` or `.txt` template file |
| **Skill reference** | User names an existing skill to use as base template |
| **Previous session** | User references a previously used template pattern |

### Phase 2: Variable Resolution

Templates use `${VARIABLE_NAME}` syntax for placeholders.

**Built-in variables** (auto-resolved from project context):

| Variable | Source |
|----------|--------|
| `${PROJECT_NAME}` | Nearest `package.json` name, `go.mod` module, or directory name |
| `${TECH_STACK}` | Detected from project files (package.json, tsconfig, go.mod, etc.) |
| `${LANGUAGE}` | Primary language detected from file extensions |
| `${TEST_FRAMEWORK}` | Detected test framework (vitest, jest, pytest, go test, etc.) |
| `${PACKAGE_MANAGER}` | npm, yarn, pnpm, pip, cargo, go modules, etc. |
| `${SRC_DIR}` | Main source directory (src/, lib/, app/, etc.) |
| `${TEST_DIR}` | Test directory (tests/, __tests__/, test/, etc.) |

**User-provided variables**: Any `${VAR}` not in the built-in list is prompted
to the user via `AskUserQuestion` before execution.

**Resolution rules:**
1. Auto-resolve built-in variables from project context
2. Check if user provided values in the input message
3. For remaining unresolved variables, ask the user
4. Validate all variables are resolved before proceeding

### Phase 3: ECC Optimization

Before execution, analyze the resolved prompt to identify relevant ECC components:

1. **Detect task type**: new feature, bug fix, refactor, test, docs, infra
2. **Match agents**: Map to available agents (planner, tdd-guide, code-reviewer, etc.)
3. **Match skills**: Identify applicable skills (coding-standards, backend-patterns, etc.)
4. **Match commands**: Identify relevant commands (/feature, /tdd, /plan, etc.)
5. **Determine model tier**: Haiku for simple, Sonnet for standard, Opus for complex

Inject matched components into the execution plan. Do NOT change the user's
intent - only enhance the execution strategy.

### Phase 4: Execution

Execute the fully resolved and optimized prompt:

1. **Plan**: If complexity >= MEDIUM, use planner agent first
2. **Implement**: Execute the task following TDD workflow when applicable
3. **Review**: Use code-reviewer agent on any code changes
4. **Verify**: Run tests and verify the implementation

### Phase 5: Summary

After execution, provide:
- What was done (changes made, files modified)
- Template variables used and their resolved values
- ECC components leveraged
- Suggestion to save as a reusable template if it was an inline prompt

## Template Format

Templates follow this structure:

```markdown
# Template: <template-name>

## Description
<what this template does>

## Variables
- ${VAR1}: <description>
- ${VAR2}: <description>

## Prompt
<the actual prompt with ${VARIABLE} placeholders>
```

### Example Template

```markdown
# Template: add-api-endpoint

## Description
Add a new REST API endpoint with full TDD workflow.

## Variables
- ${RESOURCE_NAME}: Name of the resource (e.g., "user", "team")
- ${HTTP_METHOD}: HTTP method (GET, POST, PUT, DELETE)
- ${ENDPOINT_PATH}: API path (e.g., "/api/v1/users")

## Prompt
Create a new ${HTTP_METHOD} endpoint at ${ENDPOINT_PATH} for the
${RESOURCE_NAME} resource in the ${PROJECT_NAME} project.

Use ${TEST_FRAMEWORK} for testing. Follow TDD: write tests first,
then implement the endpoint with proper validation, error handling,
and documentation.

Tech stack: ${TECH_STACK}
```

## Saved Templates Directory

Templates can be saved to and loaded from:
```
.claude/templates/
  ├── add-api-endpoint.md
  ├── add-feature.md
  ├── fix-bug.md
  └── refactor-module.md
```

## Integration with Other Skills

| Skill/Command | How It's Used |
|---------------|---------------|
| **prompt-optimizer** | Phase 3 analysis draws from its pipeline |
| **planner** | Used in Phase 4 for complex tasks |
| **tdd-guide** | Enforced when template involves code changes |
| **code-reviewer** | Auto-invoked after implementation |
| **coding-standards** | Applied to all generated code |

## Error Handling

- **Missing template**: Ask user to provide one inline or specify a file path
- **Unresolvable variables**: List missing variables and ask user to provide values
- **Execution failure**: Report what failed, suggest fixes, offer to retry
- **Ambiguous template**: Ask clarifying questions before proceeding
