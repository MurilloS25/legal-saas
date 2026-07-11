# Testing Strategy

## Goal

Testing exists to keep the MVP stable, safe, and maintainable.

The project does not require strict TDD for every UI detail, but new business modules must be built with TDD around the behavior that matters.

The most important areas are:

- Template parsing.
- Template variable replacement.
- Conditional template logic.
- Document metadata preparation.
- Notarial index metadata rules.
- Accounts receivable calculations.
- Authorization-sensitive logic.
- Document export transformations.

## TDD For New Business Modules

TDD is required for new business modules such as:

- Clients.
- Templates.
- Template variables.
- Document generation.
- Notarial index.
- Accounts receivable.

TDD does not mean every change starts with Playwright. Most TDD should begin with faster tests closer to the logic, such as Vitest schema tests, domain tests, server action tests, service/query tests, or local integration tests.

Playwright E2E tests should usually be added near the end to cover the critical user flow.

### Red

- Write or update tests that express the expected behavior first.
- Confirm the tests fail for the right reason.
- Do not implement the feature before at least one meaningful test fails.
- Choose the smallest useful test level for the behavior: unit, schema, server logic, integration, SQL/RLS, or E2E.

### Green

- Implement the smallest reasonable solution that passes the tests.
- Do not overbuild.
- Do not add features outside the ticket scope.
- Confirm the related tests pass.

### Refactor

- Remove duplication.
- Improve names and structure.
- Move code to the right architectural layer when needed.
- Keep tests green.
- Do not change behavior during refactor unless a new test describes the intended change.

## Testing Tools

The project uses:

- Vitest for unit tests.
- React Testing Library for component-level tests when needed.
- Playwright for end-to-end tests.
- TypeScript for static checks.
- ESLint for code quality checks.

## Test Types

### Unit / Schema Tests With Vitest

Use unit and schema tests for fast, deterministic logic.

Good candidates:

- Zod validations.
- Helpers.
- Pure functions.
- Domain rules.
- Simple business rules.
- Template parsing.
- Variable replacement.
- Parsing and formatting.
- Mappers.
- Money calculations.
- Period/date logic.
- Permissions or guards that can be tested without a browser.

Unit tests should not need a browser, Supabase Cloud, or real secrets.

### Integration-ish Tests / Server Logic

Use integration-ish tests when the behavior crosses a small boundary but still does not need a browser.

Good candidates:

- Server actions.
- Queries.
- Repository behavior against Supabase local.
- Operations that read or write Supabase local.
- Ownership validation.
- Form behavior that can be tested without full browser automation.

These tests must use fake data only.

### Supabase SQL / RLS Tests

Use Supabase SQL/RLS tests for database authorization and data safety.

Required for:

- New tables.
- New RLS policies.
- Ownership changes.
- Multi-user permission behavior.
- Important constraints.
- Security-sensitive data rules.

RLS tests should include positive and negative cases, such as:

- User A can access User A records.
- User A cannot access User B records.
- User A cannot create records owned by User B.
- User A cannot create child records under User B parents.
- User A cannot transfer ownership by updating `owner_id`.
- Anonymous users cannot access private user-owned records.

### Component Tests

Use component tests for important reusable UI behavior.

Good candidates:

- Form components.
- Error summary component.
- Template variable selector.
- Receivable status badge.
- Accessible dialog behavior when simple enough.

Avoid over-testing visual details.

### Playwright E2E Tests

Use Playwright for full user workflows that combine UI, Auth, routing, and persistence.

Good candidates:

- Login and logout.
- Protected routes.
- Important forms.
- Visible persistence after reload.
- Main navigation.
- Flows that combine UI, Auth, and Supabase.

Do not use Playwright for:

- Every small validation rule.
- Fragile visual details.
- Duplicating all unit tests.
- Logic that can be tested faster with Vitest.

E2E tests should be limited and high value, not exhaustive.

## E2E Criteria By Module

Each important business module should finish with at least one critical E2E flow when the module has UI.

Examples:

- Clients: create an individual person client, edit it, reload, and confirm it appears in the expected list or detail view.
- Templates: create a basic template, add fields or variables, save, reload, and confirm persistence.
- Document generation: fill minimum data, generate a document, confirm the expected download or result, and confirm the generated document is not stored in the database.
- Notarial index: register metadata and confirm it appears in the correct period.
- Accounts receivable: create a receivable, change status, reload, and confirm persistence.

Do not expand E2E coverage until the faster test layers already cover the small rules.

## Playwright Rules

- Use accessible locators first: `getByRole`, `getByLabel`, and `getByText`.
- Avoid selectors based on Tailwind classes or fragile DOM structure.
- Do not commit `playwright/.auth/`.
- Do not commit storageState files.
- Do not commit screenshots, traces, videos, or reports.
- Keep `playwright-report/` and `test-results/` ignored.
- Authenticated E2E tests require Supabase local running, a correct `.env.local`, `E2E_USER_EMAIL`, and `E2E_USER_PASSWORD`.
- Use fake test users and fake test data only.
- Do not depend on Supabase Cloud for local E2E tests.
- Do not add Playwright to CI unless a task explicitly asks for it.
- If Playwright is added to CI later, do it as a separate task with browser installation, environment variables, and a clear Supabase local/test strategy.

## Validation Matrix

Agents must choose validation commands based on the type of change.

### Documentation-only changes

Run at most:

- Manual review.

Do not run by default:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm e2e`

Only run commands if the documentation affects executable examples, package scripts, CI/CD, framework configuration, Supabase commands, or the user explicitly asks.

### UI/React changes without critical logic

Run:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`

Optional:

- `pnpm test` if related tests exist or behavior changed.
- `pnpm e2e` if protected routes or critical flows changed.

### Validation, schema, helper, or business logic changes

Run:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

### Auth, protected routes, settings, or critical flows

Run:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm e2e`

### Database, RLS, or migration changes

Run:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- The relevant Supabase SQL/RLS tests.

Run `pnpm e2e` only if the database change also affects UI behavior or critical user flows.

### Large module changes

Run:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- Supabase SQL/RLS tests if applicable.
- `pnpm e2e` if the module has critical UI.

Agents must explain which commands were skipped and why.

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

RLS-specific tests should be added or updated whenever tables, policies, ownership rules, or important constraints change.

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
- Authenticated E2E tests require `E2E_USER_EMAIL` and `E2E_USER_PASSWORD`.
- `playwright/.auth/` must stay uncommitted.
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
- Not included in CI yet (requires a live Supabase local instance and test credentials).
- Project execution order: `setup` → `chromium-clients` + `chromium-templates` + `chromium-template-fields` (parallel) → `chromium-authenticated` (last, logs out).

| Playwright project | Test file | Covers |
|---|---|---|
| `chromium-clients` | `e2e/clients-authenticated.spec.ts` | Create, edit, delete client; persistence after reload |
| `chromium-templates` | `e2e/templates-authenticated.spec.ts` | Create, edit template; status change; persistence after reload |
| `chromium-template-fields` | `e2e/template-fields-authenticated.spec.ts` | Add, edit, delete template fields; validation error; persistence after reload |
| `chromium-authenticated` | `e2e/settings-authenticated.spec.ts` | Dashboard, settings, profile, document settings, logout |

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

- Full workflow flows: generate document from template + client data.
- CI integration with a Supabase test environment.

## TODO

- Decide between centralized tests or feature-local tests.
- Add test factories for fake users, clients, templates, and receivables.
- Add RLS testing strategy after Supabase schema exists.
- Phase 3: extend authenticated E2E tests to cover document generation workflows.
- Phase 3: add E2E to CI pipeline with a dedicated Supabase test environment.
