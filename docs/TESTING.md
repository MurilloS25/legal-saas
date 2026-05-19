# Testing

## Current State

Vitest and Playwright are available for future tests. No product behavior exists yet, so test coverage is intentionally minimal.

## Test Strategy

- Unit tests with Vitest for domain rules, validation, and application use cases.
- Integration tests for repository behavior and RLS-sensitive access patterns.
- E2E tests with Playwright for critical user workflows once screens exist.
- Accessibility checks for form-heavy flows.

## Priority Areas

- Authorization and RLS behavior.
- Data minimization and validation.
- Template versioning rules.
- Document export boundaries.
- Receivables calculations.

## Commands

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## TODO

- Add Vitest config when the first unit test is added.
- Add Playwright config when the first E2E flow exists.
- Add test database strategy after Supabase local workflow is defined.
