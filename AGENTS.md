<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes - APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Agent Instructions

This repository is the MVP foundation for a legal productivity SaaS for independent lawyers in Costa Rica.

## Product Boundaries

- The app helps manage legal document templates ("machotes") and structured metadata.
- The MVP must not store generated legal documents or full sensitive escritura content.
- The MVP does not handle digital signatures, official legal submissions, official notarial index submission, or legal responsibility.
- AI assists development only. Do not add AI product features unless the product scope changes explicitly.

## Technical Direction

- Use Next.js App Router, TypeScript, Tailwind CSS, ESLint, and the `src/` directory.
- Use the `@/*` import alias.
- Use Supabase for Auth, Postgres, and future RLS-based authorization.
- Production target is Vercel plus Supabase Cloud.
- Docker is local-development support only, mainly alongside the Supabase local stack.
- Prefer a modular monolith with Clean Architecture-inspired boundaries.

## Architecture Rules

- `src/domain/*`: pure business language and rules. No framework, Supabase, or browser imports.
- `src/application/*`: use cases and orchestration. Depend on domain contracts, not concrete infrastructure.
- `src/infrastructure/*`: Supabase, repositories, external adapters, and future document export adapters.
- `src/features/*`: feature composition and UI-facing modules.
- `src/components/*`: shared UI, layout, and form primitives.
- `src/app/*`: App Router routes, layouts, route handlers, and metadata.

## Security Rules


## Workflow

- Read the relevant local Next.js docs before changing App Router, server/client component, environment, auth, or deployment code.
- Keep changes small and aligned with `RULES.md` and `docs/PRODUCT_RULES.md`.
- Add TODOs for intentionally deferred implementation, but do not stub misleading product behavior.
- Run lint, typecheck, tests, and build when practical before handing off.
