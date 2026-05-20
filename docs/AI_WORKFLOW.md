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
- The app helps with templates, Word generation, client reuse, notarial index metadata, and receivables.
- The app does not store generated legal documents.
- The app does not provide legal advice.
- The app does not submit official legal documents.
- The app does not include AI product features in the MVP.
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
3. Ask AI for a plan before code.
4. Review the plan.
5. Ask AI to implement only the approved scope.
6. Review the diff manually.
7. Run validation commands according to the Validation Policy.
8. Commit only reviewed changes.

## Validation Policy

Agents must choose validation commands based on the type of change.

For documentation-only changes:

- Do not run `pnpm lint`, `pnpm typecheck`, `pnpm test`, or `pnpm build` by default.
- Only run them if the documentation change affects executable examples, package scripts, CI/CD, framework configuration, Supabase commands, or if the user explicitly asks.

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
- Store generated documents.
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
7. Did it introduce generated document storage?
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
