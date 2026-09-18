<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

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
| UI implementation, visual design, app layout, components | `docs/UI_GUIDELINES.md`, `DESIGN.md` (repo root — color tokens, components) |
| Word (`.docx`) export: generation, download endpoint, privacy | `docs/DOCX_EXPORT.md`, `docs/SECURITY.md` |
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

- Store generated Word/PDF files, signed documents, official submissions, or generated document storage paths.
- Store full escritura content outside the explicitly approved persistent draft workflow.
- Handle digital signatures.
- Submit official legal documents.
- Submit official notarial index information.
- Provide legal advice or legal judgment.
- Act as a legal authority or document custody system.
- Add AI product features unless the product scope changes explicitly.

The application may store only structured metadata required for:

- Client reuse.
- Template management.
- Persistent draft escrituras, limited to validated `field_values` and server-rendered text snapshots.
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
- Modular monolith organized pragmatically by feature.

The project does not use strict Clean Architecture. `docs/ARCHITECTURE.md` is
the source of truth for feature boundaries, imports, and the gradual migration
away from unused global layer placeholders.

For detailed architecture rules, read `docs/ARCHITECTURE.md`.

Do not duplicate architecture decisions in this file.

## Non-Negotiable Rules

These rules apply to all tasks:

- Do not implement features outside MVP scope.
- Do not create database tables until the schema task is approved.
- Do not add document-generation logic until the template model is approved.
- Do not store generated Word/PDF files, signed documents, official submissions, or generated document storage paths.
- Do not store full escritura content outside the explicitly approved persistent draft workflow.
- Treat persistent Escritura values, rendered text, and structured Machote snapshots as sensitive Workspace data: validate them, protect them with RLS, and never log their content.
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

For UI implementation tasks, read `docs/UI_GUIDELINES.md` first, then `DESIGN.md` (repo root) for the actual color tokens, typography, spacing, and component patterns — it documents the current desktop top navbar/mobile drawer shell and the approved visual system.

`docs/design/` holds the original Stitch/Sober Juris moodboard and PNG mockups — historical inspiration only, superseded by `DESIGN.md` for anything token-level. Read `docs/design/README.md` before using the PNG mockups.

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

For new business modules, follow Red-Green-Refactor TDD as described in `docs/TESTING.md`.

TDD should normally start with fast tests close to the logic. Add Playwright E2E near the end for the module's critical UI flow.

## Validation Policy

Agents must choose validation commands based on the type of change.

`docs/TESTING.md` is the authoritative validation matrix. The short version is:

For documentation-only changes:

- Do not run `pnpm lint`, `pnpm typecheck`, `pnpm test`, or `pnpm build` by default.
- Do not run `pnpm e2e` by default.
- Only run commands if the documentation change affects executable examples, package scripts, CI/CD, framework configuration, Supabase commands, or if the user explicitly asks.

For UI/React changes without critical logic:

- Run `pnpm lint`, `pnpm typecheck`, and `pnpm build`.
- Run `pnpm test` or `pnpm e2e` when related behavior, protected routes, or critical flows changed.

For configuration changes:

- Run the specific command related to the changed configuration.
- If the change affects CI, package scripts, dependencies, TypeScript, Next.js, ESLint, Tailwind, Supabase, or build behavior, run the relevant validation commands.

For dependency, source code, tests, framework config, Supabase config, or CI changes:

- Run the appropriate checks, normally:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`

For Auth, protected routes, settings, critical flows, or large module changes:

- Run the relevant full checks from `docs/TESTING.md`.
- Include `pnpm e2e` when the changed module has critical UI coverage or the task asks for it.

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

## Playwright Rule

Use Playwright only for high-value user workflows. Prefer accessible locators such as `getByRole`, `getByLabel`, and `getByText`.

Do not commit `playwright/.auth/`, storageState files, screenshots, traces, reports, or test artifacts.

Do not add Playwright to CI unless the task explicitly asks for it.

## Supabase Safety Rule

Never use `supabase db push` or touch Supabase Cloud without explicit user permission.

For database changes:

1. Use versioned migrations.
2. Update documentation when decisions change.
3. Add or update RLS tests.
4. Run local Supabase validation.
5. Keep generated Word/PDF files, signed documents, official submission payloads, and generated document storage paths out of the database.
6. Persist Escritura content only through the approved `documents` model, protected by Workspace- and role-based RLS and safe logging rules.

## Worktree Rule

Do not create Git worktrees unless the user explicitly asks for one.

Work in the user's current worktree. When a task needs isolation, create or switch to a normal Git branch inside the current worktree.

Before any task:

1. Run `git status`.
2. Run `git branch --show-current`.
3. If there are unexpected uncommitted changes, stop and ask before editing.

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
