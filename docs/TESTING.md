# Testing Strategy

## Goal

Testing exists to keep the MVP stable, safe, and maintainable.

The project does not require strict TDD for every UI detail, but critical business logic must be tested.

The most important areas are:

- Template parsing.
- Template variable replacement.
- Conditional template logic.
- Document metadata preparation.
- Notarial index metadata rules.
- Accounts receivable calculations.
- Authorization-sensitive logic.
- Document export transformations.

## Testing Tools

The project uses:

- Vitest for unit tests.
- React Testing Library for component-level tests when needed.
- Playwright for end-to-end tests.
- TypeScript for static checks.
- ESLint for code quality checks.

## Test Types

### Unit Tests

Use unit tests for pure logic.

Good candidates:

- Domain rules.
- Validation functions.
- Formatting helpers.
- Template parsing.
- Variable replacement.
- Money calculations.
- Period/date logic.
- Access-control helper logic.

Unit tests should be fast and deterministic.

### Component Tests

Use component tests for important reusable UI behavior.

Good candidates:

- Form components.
- Error summary component.
- Template variable selector.
- Receivable status badge.
- Accessible dialog behavior when simple enough.

Avoid over-testing visual details.

### E2E Tests

Use Playwright for full user workflows.

Good candidates:

- User logs in.
- User creates a client.
- User creates a template.
- User generates a Word document.
- User registers notarial index metadata.
- User marks a receivable as paid.

E2E tests should focus on critical flows, not every minor UI detail.

## TDD Policy

TDD is recommended for critical logic.

TDD is required or strongly preferred for:

- Template variable parser.
- Template rendering/resolution logic.
- Conditional template blocks.
- Required field validation.
- Notarial index period rules.
- Accounts receivable calculations.
- Data minimization rules.
- Authorization-sensitive rules.

TDD is optional for:

- Layout components.
- Static pages.
- Styling-only changes.
- Basic dashboard shells.

## Temporary Foundation Phase

During the foundation phase, the test script may use:

```bash
vitest run --passWithNoTests
```

This is acceptable only while no real features exist.

Once critical business logic is added, the project should include real tests.

The long-term goal is to remove reliance on passing with no tests.

## Recommended Test Structure

```txt
tests/
├─ unit/
│  ├─ domain/
│  ├─ application/
│  └─ lib/
├─ integration/
└─ e2e/
```

Alternative feature-local tests are also acceptable if they improve maintainability:

```txt
src/features/clients/__tests__/
src/domain/templates/__tests__/
```

The project should choose one convention and stay consistent.

## Naming Convention

Use descriptive names.

Examples:

```txt
template-variable-parser.test.ts
receivable-status.test.ts
notarial-index-period.test.ts
client-validation.test.ts
```

Test descriptions should read like behavior.

Example:

```ts
it("replaces a client full name variable with the selected client name", () => {})
```

## What Must Be Tested First

When implementation begins, prioritize tests for:

1. Template variable parsing.
2. Template variable replacement.
3. Required field validation.
4. Client validation.
5. Receivable status transitions.
6. Notarial index period helper.
7. User ownership/access rules.

## Test Data Rules

Test data must be fake.

Do not use:

- Real client names.
- Real identification numbers.
- Real legal documents.
- Real escritura text.
- Real notarial data from family members or clients.

Use clearly fake data.

Example:

```txt
Client: Test Client One
Identification: 000000000
Template: Test Template
```

## Security Testing

Security-related tests should include negative cases.

Examples:

- User A cannot access User B clients.
- User A cannot update User B templates.
- User A cannot read User B receivables.
- Invalid template variables are rejected.
- Unsafe template content is rejected or sanitized.

RLS-specific tests should be added after the database schema and Supabase test workflow are approved.

## Accessibility Testing

E2E tests should later verify:

- Important pages can be reached with keyboard.
- Forms show validation errors.
- Focus moves predictably in dialogs.
- Important buttons have accessible names.

Automated accessibility checks may be added later, but manual review is still required.

## CI Testing

CI should run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Future E2E tests may run separately because they are slower.

## What Not To Over-Test

Avoid spending too much time testing:

- Tailwind class names.
- Exact spacing.
- Exact colors.
- Static text that changes frequently.
- Internal implementation details.

Test behavior, not implementation details.

## Definition Of Done For Critical Logic

Critical logic is done only when:

1. It has a clear use case.
2. It has validation.
3. It has tests for happy path.
4. It has tests for failure cases.
5. It does not store unnecessary sensitive data.
6. It passes lint, typecheck, tests, and build.

## Running Tests

### Unit tests (Vitest)

```bash
pnpm test
```

### RLS tests (Supabase local)

```bash
pnpm supabase test db --local supabase/tests/rls_initial_schema.test.sql
```

Requires Supabase local to be running (`pnpm supabase start`).

### E2E tests (Playwright)

```bash
pnpm e2e          # headless, list reporter
pnpm e2e:ui       # interactive Playwright UI
pnpm e2e:headed   # headed browser
```

**Requirements before running E2E tests:**

- `.env.local` must be configured with the Supabase local credentials.
- Supabase local must be running (`pnpm supabase start`) for flows that depend on Auth, such as login, redirect, and error handling.
- The dev server starts automatically via `pnpm dev` unless it is already running on port 3000.

**Phase 1 scope (smoke, unauthenticated — current):**

- Smoke tests for unauthenticated flows: login page, signup page, and protected route redirects.
- Tests do not create real users or share authentication state between runs.
- No visual regression tests.
- Not included in CI yet.
- Test file: `e2e/auth-smoke.spec.ts`
- Playwright project: `chromium-public`

**Phase 2 scope (authenticated — current):**

- Authenticated tests using a dedicated local test user and Playwright `storageState`.
- Covers: dashboard access, settings page, save lawyer profile, save document settings, persistence after reload, and logout.
- Not included in CI yet (requires a live Supabase local instance and test credentials).
- Test file: `e2e/settings-authenticated.spec.ts`
- Playwright project: `chromium-authenticated` (depends on `setup`)

**Setting up authenticated E2E tests:**

1. Start Supabase local:
   ```bash
   pnpm supabase start
   ```

2. Create a dedicated test user via the Supabase local dashboard (http://localhost:54323) or by signing up through the app at http://localhost:3000/signup. Use a clearly fake address — for example `e2e-test@example.com`.

3. Add the credentials to `.env.local` (never commit this file):
   ```
   E2E_USER_EMAIL=e2e-test@example.com
   E2E_USER_PASSWORD=a-strong-test-password
   ```

4. Start the dev server (Playwright starts it automatically via `webServer`, but you can also start it manually):
   ```bash
   pnpm dev
   ```

5. Run all E2E tests:
   ```bash
   pnpm e2e
   ```

**Auth state file:**

Playwright saves session cookies/tokens to `playwright/.auth/user.json` after the `setup` project runs.

- This file is listed in `.gitignore` and must never be committed.
- It is regenerated automatically each time `pnpm e2e` runs.
- If the file is missing or the session expires, re-run `pnpm e2e` to regenerate it.

**Phase 3 (future):**

- Full workflow flows: create client, create template, generate document.
- CI integration with a Supabase test environment.

## TODO

- Decide between centralized tests or feature-local tests.
- Add test factories for fake users, clients, templates, and receivables.
- Add RLS testing strategy after Supabase schema exists.
- Phase 3: extend authenticated E2E tests to cover client and template workflows.
- Phase 3: add E2E to CI pipeline with a dedicated Supabase test environment.
