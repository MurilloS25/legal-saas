<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes - APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Agent Instructions

This repository is the MVP foundation for a legal productivity SaaS for independent lawyers in Costa Rica.

The application helps lawyers manage reusable legal document templates ("machotes"), generate editable Word documents from approved templates, reuse client metadata, prepare notarial index metadata, and track basic accounts receivable.

AI tools are used to assist development. AI is not part of the product MVP.

## How To Use This File

This file is a routing guide for coding agents.

Do not read every documentation file automatically for every task.

Read only the documents relevant to the task you are working on.

Use this file to decide where the authoritative information lives.

## Documentation Routing

Use this guide before starting any task:

| Task Type | Required Docs |
|---|---|
| Product scope, MVP limits, included/excluded features | `docs/MVP_SCOPE.md`, `docs/PRODUCT_RULES.md` |
| Architecture, folder structure, dependency direction | `docs/ARCHITECTURE.md` |
| Database design, tables, relationships, RLS planning | `docs/DATABASE.md`, `docs/SECURITY.md` |
| Security, OWASP, secrets, logging, RLS | `docs/SECURITY.md` |
| Accessibility, forms, keyboard navigation, focus, errors | `docs/ACCESSIBILITY.md` |
| Testing, TDD rules, unit tests, E2E tests | `docs/TESTING.md` |
| CI/CD, GitHub Actions, Dependabot, deployment flow | `docs/CI_CD.md` |
| Docker usage and local development strategy | `docs/DOCKER.md` |
| AI-assisted development workflow and review checklist | `docs/AI_WORKFLOW.md` |
| General development rules | `RULES.md` |
| Claude-specific behavior | `CLAUDE.md` |

If the task touches multiple areas, read the relevant documents for each area.

Example:

- A new client form requires `MVP_SCOPE.md`, `ARCHITECTURE.md`, `ACCESSIBILITY.md`, `SECURITY.md`, and `TESTING.md`.
- A Supabase migration requires `DATABASE.md`, `SECURITY.md`, and `ARCHITECTURE.md`.
- A documentation-only update may require only the affected document.

## Product Boundaries

The MVP must help the lawyer work faster, but it must not replace the lawyer's professional judgment or official legal responsibilities.

The application must not:

- Store generated legal documents.
- Store full sensitive escritura content.
- Handle digital signatures.
- Submit official legal documents.
- Submit official notarial index information.
- Provide legal advice or legal judgment.
- Act as a legal authority or document custody system.
- Add AI product features unless the product scope changes explicitly.

The application may store only structured metadata required for:

- Client reuse.
- Template management.
- Notarial index preparation.
- Accounts receivable tracking.
- Basic audit and operational traceability.

## Technical Direction

Use the following stack and project direction:

- Next.js App Router.
- TypeScript.
- Tailwind CSS.
- ESLint.
- `src/` directory.
- `@/*` import alias.
- Supabase for Auth, Postgres, and RLS-based authorization.
- Vercel plus Supabase Cloud as the intended MVP production target.
- Docker for local development support only, mainly for the Supabase local stack.
- Modular monolith with Clean Architecture-inspired boundaries.

For detailed architecture rules, read `docs/ARCHITECTURE.md`.

Do not duplicate architecture decisions in this file.

## Non-Negotiable Rules

These rules apply to all tasks:

- Do not implement features outside MVP scope.
- Do not create database tables until the schema task is approved.
- Do not add document-generation logic until the template model is approved.
- Do not store generated legal documents.
- Do not store full sensitive escritura content.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` to client-side code.
- Do not commit real `.env` files.
- Do not add dependencies without explaining why.
- Do not bypass Supabase RLS requirements.
- Do not move business rules into React components.
- Do not create misleading placeholder behavior that looks production-ready.
- Do not change architecture decisions without updating the relevant docs.

## TODO Policy

Documentation may contain `TODO` sections.

A `TODO` means the decision is intentionally deferred.

Agents must not implement TODO items automatically.

Before working on a TODO:

1. Confirm the task was explicitly requested.
2. Read the related documentation.
3. Propose a short plan.
4. Wait for approval if the task changes architecture, database schema, security, or product scope.

TODOs are not permission to invent features.

## Next.js Version Rule

Before changing Next.js code, read the relevant local Next.js documentation in:

```txt
node_modules/next/dist/docs/
```

This project uses a newer Next.js version. Do not rely only on training data.

## Security Rule

Security is mandatory.

For security-sensitive tasks, read `docs/SECURITY.md`.

This includes:

- Auth.
- Supabase.
- RLS.
- Database access.
- Environment variables.
- Logging.
- Template rendering.
- Document generation.
- User-owned data.

## Accessibility Rule

Accessibility is mandatory for UI work.

For UI tasks, read `docs/ACCESSIBILITY.md`.

All user-facing forms must consider:

- Labels.
- Keyboard navigation.
- Visible focus.
- Clear validation messages.
- Logical tab order.
- Accessible dialogs and menus.

## Testing Rule

Critical business logic must be tested.

For testing guidance, read `docs/TESTING.md`.

Unit tests are required for critical logic such as:

- Template variable parsing.
- Template variable replacement.
- Conditional template blocks.
- Required field validation.
- Notarial index metadata rules.
- Accounts receivable calculations.
- Authorization-sensitive logic.
- Document export transformations.

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

## Workflow

Keep changes small and reviewable.

Before handing off significant changes, apply the Validation Policy above. If a command was skipped, explain why.

## Final Response Expectations

When finishing a coding task, summarize:

1. What changed.
2. Why it changed.
3. Files modified.
4. Commands run.
5. Risks or follow-up tasks.
