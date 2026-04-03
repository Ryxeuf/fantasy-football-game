# Template: add-feature

## Description
Add a new feature end-to-end across the project with planning, TDD, and code review.

## Variables
- ${FEATURE_NAME}: Short name of the feature (e.g., "player-trading", "match-replay")
- ${FEATURE_DESCRIPTION}: Detailed description of what the feature should do

## Prompt
Implement the "${FEATURE_NAME}" feature: ${FEATURE_DESCRIPTION}

Project: ${PROJECT_NAME}
Tech stack: ${TECH_STACK}
Language: ${LANGUAGE}

Follow the full development workflow:
1. Plan the implementation (use planner agent for HIGH+ complexity)
2. Write tests first (TDD)
3. Implement minimal code to pass tests
4. Refactor and review
5. Verify 80%+ test coverage
