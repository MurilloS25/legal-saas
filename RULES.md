# Development Rules

These rules are strict for the MVP foundation and future product work.

## Scope Control

- Do not implement product screens unless the task explicitly asks for them.
- Do not create database tables or migrations without an approved schema task.
- Do not add document-generation logic until the generation boundary is designed.
- Do not add AI product features. AI is currently a development aid only.
- Add TODO sections where implementation is intentionally deferred.

## Security

- Never expose `SUPABASE_SERVICE_ROLE_KEY` in Client Components, browser code, logs, or `NEXT_PUBLIC_*` variables.
- Use Supabase anon keys only for public client initialization.
- Use server-only code for privileged operations.
- Require RLS for every user-owned table before real user data is stored.
- Store generated Word/PDF files, signed documents, official submissions, and generated document storage paths nowhere in the application.
- Store full escritura content only through the explicitly approved persistent draft workflow.
- Treat draft `field_values` and `rendered_content` as sensitive user-owned data: validate it, protect it with RLS, and never log it.
- Keep structured metadata minimal and purpose-bound.

## Architecture

- Keep domain logic independent of Next.js, React, Supabase, and browser APIs.
- Keep use cases in `src/application/*`.
- Keep Supabase and external adapters in `src/infrastructure/*`.
- Keep route-level composition in `src/app/*` and feature composition in `src/features/*`.
- Prefer clear modules over generic abstractions.
- Use `@/*` imports for source modules.

## Quality

- Keep TypeScript strict.
- Choose validation commands based on the change type.
- Follow the validation matrix in `docs/TESTING.md`.
- Do not run `pnpm lint`, `pnpm typecheck`, `pnpm test`, or `pnpm build` by default for documentation-only changes unless the documentation affects executable examples, package scripts, CI/CD, framework configuration, Supabase commands, or the user explicitly asks.
- Do not run `pnpm e2e` by default for documentation-only changes.
- Run full validation for source code, dependency, package script, framework configuration, Supabase configuration, CI, or build behavior changes when practical.
- Explain which validation commands were skipped and why.
- Add tests with new behavior, especially authorization, validation, and data minimization logic.
- Use Red-Green-Refactor TDD for new business modules.
- Add limited, high-value Playwright E2E coverage for critical UI flows after lower-level tests are in place.
- Follow accessibility requirements in `docs/ACCESSIBILITY.md`.
- Follow security requirements in `docs/SECURITY.md`.

## Git And AI Workflow

- Do not create Git worktrees unless the user explicitly asks.
- Work in the current worktree and use normal branches for task isolation.
- Before editing, run `git status` and `git branch --show-current`.
- Stop and ask before editing if unexpected uncommitted changes exist.

## Supabase Safety

- Never touch Supabase Cloud without explicit user permission.
- Never run `supabase db push` without explicit user permission.
- Use versioned migrations for database changes.
- Add or update RLS tests when ownership, policies, tables, or important constraints change.

## Documentation

- Update docs when decisions change.
- Keep README commands current.
- Document non-goals as clearly as goals.
