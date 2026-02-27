# AGENT.md

## Puropse

This repository is a monorepo for handling markdown.

## Direcotry

- `agent-docs`: Documents for coding agent
- `packages`: Packages in this repo

## Packages

- `parser`: Markdown parser
- `editor`: Markdown WYSIWYG editor
- `sample-app`: Sample application using the parser and editor

## Commands

For root direcotory:

```bash
pnpm install # Install dependencies for all packages
pnpm run build # Build all packages
pnpm run test # Run tests for all packages
``` 

For each package:

```bash
pnpm run build # Build the package
pnpm run test # Run tests for the package
pnpm run lint # Lint the package
pnpm run lint:fix # Fix linting issues
pnpm run format # Format the code
```

## About Testing

- Unit Tests
    - File name: `*.test.ts`
    - Located in the same directory as the code being tested
    - Should cover individual functions and components in isolation
- Integration Tests
    - File name: `test/**/*.test.ts`
    - Located in the `tests` directory at the root of each package
    - Should cover the interaction between multiple components or functions
- E2E Tests (If necessary)
    - File name: `e2e/**/*.test.ts`
    - Located in the `e2e` directory at the root of each package
    - Should cover the entire flow of the application from the user's perspective

## Coding Guidelines

- Use TypeScript for all packages
- You should follow test-driven development (TDD) approach. This should be done in Unit Tests.
    1. **Red**: Write a failing test case that defines a desired improvement or new function.
    2. **Green**: Write the minimum amount of code necessary to make the test pass.
    3. **Refactor**: Clean up the code, ensuring it adheres to best practices

## Prohibited Practices

- Do not use `node -e` to test code snippets. Always write proper test cases in the test files.