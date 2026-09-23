# AI Workflow

## Goal

This project uses AI tools to accelerate development while keeping architecture, security, and product scope under control.

AI tools may help with:

- Code generation.
- Refactoring.
- Documentation.
- Test creation.
- Architecture review.
- Security review.
- Accessibility review.
- Prompting and planning.

AI tools must not make product or legal scope decisions without explicit approval.

## Tools

The expected AI-assisted workflow may include:

- ChatGPT for planning, architecture, documentation, review, and prompts.
- Codex for repository-level changes and code generation.
- Claude Code for implementation support in the local IDE.
- GitHub Copilot or similar tools if used later.

## Core Rule

AI can propose.

The developer decides.

Do not accept AI-generated changes blindly.

## Required Context For AI Agents

AI agents must understand:

- This is a legal productivity SaaS MVP.
- The primary users are independent lawyers in Costa Rica.
- The app helps with templates, persistent draft escrituras, Word generation, client reuse, notarial index metadata, and receivables.
- The app may store validated `field_values`, server-rendered text, and the minimal structured Machote snapshot required by the approved persistent Escritura workflow.
- The app does not store generated Word/PDF files, signed documents, official submissions, or generated document storage paths.
- The app does not provide legal advice.
- The app does not submit official legal documents.
- The only AI product feature is the bounded "Crear con IA" draft Machote generation (`docs/AI_TEMPLATE_GENERATION.md`); do not add others without explicit scope approval.
- Security, accessibility, and data minimization are mandatory.

## Agent Instruction Files

The repository uses:

- `AGENTS.md`
- `CLAUDE.md`
- `RULES.md`
- `docs/PRODUCT_RULES.md`
- `docs/ARCHITECTURE.md`
- `docs/SECURITY.md`
- `docs/ACCESSIBILITY.md`
- `docs/TESTING.md`

Agents should read these before implementing features.

## Safe AI Workflow

Recommended workflow:

1. Define the task clearly.
2. Confirm the task is inside MVP scope.
3. Run `git status` and `git branch --show-current`.
4. If there are unexpected local changes, stop and ask before editing.
5. Ask AI for a plan before code when the task changes behavior, data, security, or architecture.
6. Review the plan.
7. Ask AI to implement only the approved scope.
8. Review the diff manually.
9. Run validation commands according to the Validation Policy.
10. Commit only reviewed changes.

## Claude / Codex Responsibilities

The normal workflow is:

- Claude implements requested changes.
- Codex reviews when the user asks for review.
- Codex must not modify files during review-only tasks.
- Either tool may implement when the user explicitly asks it to do so.

Do not create Git worktrees unless the user explicitly asks for one.

Work in the current user worktree. When isolation is needed, create or switch to a normal Git branch in the current worktree.

Do not use `.claude/worktrees/` unless explicitly authorized by the user.

## TDD For New Modules

New business modules should follow the Red-Green-Refactor workflow documented in `docs/TESTING.md`.

This applies to modules such as clients, templates, template variables, document generation, notarial index, and receivables.

Start with fast tests close to the logic. Use Playwright E2E only for limited, high-value user flows after the lower-level behavior is covered.

## Validation Policy

Agents must choose validation commands based on the type of change.

The authoritative validation matrix is in `docs/TESTING.md`.

For documentation-only changes:

- Do not run `pnpm lint`, `pnpm typecheck`, `pnpm test`, or `pnpm build` by default.
- Do not run `pnpm e2e` by default.
- Only run commands if the documentation change affects executable examples, package scripts, CI/CD, framework configuration, Supabase commands, or if the user explicitly asks.

For configuration changes:

- Run the specific command related to the changed configuration.
- If the change affects CI, package scripts, dependencies, TypeScript, Next.js, ESLint, Tailwind, Supabase, or build behavior, run the relevant validation commands.

For dependency, source code, tests, framework config, Supabase config, or CI changes:

- Run the appropriate checks, normally:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`

For Supabase local setup changes:

- Run only the relevant Supabase commands when needed:
  - `pnpm supabase --version`
  - `pnpm supabase status`
  - `pnpm supabase start`
  - `pnpm supabase stop`

Agents must explain which commands were skipped and why.

Examples:

- Updating only `docs/DATABASE.md`: no pnpm validation needed by default.
- Updating `.github/workflows/ci.yml`: run relevant CI-equivalent checks.
- Updating `package.json` or `pnpm-lock.yaml`: run install and full validation.
- Updating application TypeScript/React code: run lint, typecheck, tests, and build.

## Playwright E2E Policy

Use Playwright for critical user workflows that combine UI, Auth, routing, and Supabase persistence.

Do not use Playwright to duplicate every unit test or to assert fragile visual details.

Agents must not commit `playwright/.auth/`, storageState files, screenshots, traces, reports, or `test-results/`.

Keep Playwright out of CI unless a task explicitly asks to add it with browser installation, environment variables, and a clear Supabase local/test strategy.

## Supabase Safety

Never touch Supabase Cloud without explicit user permission.

Never run `supabase db push` without explicit user permission.

For database changes:

1. Use versioned migrations.
2. Update database/security documentation when decisions change.
3. Add or update RLS tests for ownership and access-control behavior.
4. Run local Supabase validation.
5. Do not store generated Word/PDF files, signed documents, official submissions, or generated document storage paths.
6. Persist Escritura content only through the approved Workspace-owned `documents` model, protected by RLS and no-content logging rules.

## Prompting Rules

Prompts should include:

- Product context.
- Exact files or modules to change.
- What not to change.
- Security constraints.
- Accessibility constraints if UI is involved.
- Testing expectations.
- Expected output.

Example prompt structure:

```txt
Context:
Task:
Files to change:
Files not to change:
Security rules:
Accessibility rules:
Testing expectations:
Expected final summary:
```

## What AI Must Not Do

AI must not:

- Add features outside MVP scope.
- Create database tables without approved schema.
- Store generated Word/PDF files, signed documents, official submissions, or generated document storage paths.
- Store draft text outside the approved `documents` draft model.
- Add digital signature flows.
- Add official submission flows.
- Add AI legal advice features.
- Add unnecessary dependencies.
- Expose secrets.
- Bypass RLS.
- Put business rules directly in UI components.
- Rewrite large parts of the app without approval.
- Change architecture rules without updating docs.

## Code Review Checklist For AI Changes

Before accepting AI-generated changes, verify:

1. Is the change inside the requested scope?
2. Did it modify unrelated files?
3. Did it add dependencies?
4. Did it expose secrets?
5. Did it bypass architecture boundaries?
6. Did it add direct Supabase calls in UI components?
7. Did it introduce generated file storage or draft text outside the approved `documents` model?
8. Did it affect RLS or auth?
9. Did it include or update tests when needed?
10. Did it keep accessibility in mind?
11. Did it update documentation if decisions changed?
12. Were validation commands chosen according to the Validation Policy?

## Suggested AI Commands Or Prompts

### Architecture Review

```txt
Review the current changes against docs/ARCHITECTURE.md.
Do not rewrite code.
Return only concrete violations and recommended fixes.
```

### Security Review

```txt
Review the current changes against docs/SECURITY.md and OWASP Top 10.
Focus on access control, secrets, input validation, unsafe rendering, logging, and data minimization.
Do not rewrite code unless explicitly asked.
```

### Accessibility Review

```txt
Review the current UI changes against docs/ACCESSIBILITY.md.
Focus on labels, keyboard navigation, focus management, error messages, and accessible names.
```

### Test Creation

```txt
Create tests for the approved use case.
Focus on critical business logic, happy path, and failure cases.
Do not change production code unless a bug is found and explained.
```

### Documentation Update

```txt
Update the relevant docs to reflect the approved architecture decision.
Do not introduce new product scope.
```

## Commit Rules For AI-Assisted Work

Commits should be small and meaningful.

Examples:

```txt
docs: refine architecture foundation
docs: add accessibility and testing strategy
chore: configure supabase local setup
feat: add client domain model
test: add template variable parser tests
```

Avoid:

```txt
update stuff
changes
ai generated code
```

## Developer Responsibility

The developer is responsible for:

- Reviewing AI output.
- Running commands.
- Checking diffs.
- Confirming security.
- Confirming scope.
- Confirming tests.
- Making final architecture decisions.

## TODO

- Add Claude custom commands if the tool supports them.
- Add code review prompt templates under a dedicated folder if useful.
- Add examples for feature implementation prompts.
- Define how AI should help with database migrations after schema approval.
