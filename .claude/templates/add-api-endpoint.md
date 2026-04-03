# Template: add-api-endpoint

## Description
Add a new REST API endpoint with full TDD workflow, validation, and error handling.

## Variables
- ${RESOURCE_NAME}: Name of the resource (e.g., "user", "team", "player")
- ${HTTP_METHOD}: HTTP method (GET, POST, PUT, DELETE)
- ${ENDPOINT_PATH}: API path (e.g., "/api/v1/users")

## Prompt
Create a new ${HTTP_METHOD} endpoint at ${ENDPOINT_PATH} for the ${RESOURCE_NAME} resource.

Use ${TEST_FRAMEWORK} for testing. Follow TDD: write tests first, then implement the endpoint with proper input validation, error handling, and consistent API response format.

Tech stack: ${TECH_STACK}
Package manager: ${PACKAGE_MANAGER}
Source directory: ${SRC_DIR}
