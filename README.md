# Legal Docs SaaS

MVP foundation for a legal productivity SaaS for independent lawyers in Costa Rica.

The product helps notarial workspaces manage reusable legal document templates ("machotes"), persistent escrituras, clients, notarial index preparation, and accounts receivable. An Escritura stores validated values, its last rendered text, and the minimal structured Machote snapshot needed to reopen and export the version from which it was created. The application must not store generated Word/PDF files, signed documents, official submissions, or generated document storage paths.

## Stack

- Next.js App Router with TypeScript, Tailwind CSS, ESLint, and `src/`
- Supabase for Auth, Postgres, and RLS-based authorization
- Vercel for production hosting
- Docker only for local development support, mainly alongside the Supabase local stack
- Modular monolith organized pragmatically by feature
- GitHub Actions CI and Dependabot updates
- Vitest, Supabase SQL/RLS tests, and Playwright for focused automated coverage

## Getting Started

Install dependencies and run the local app:

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Local Development

Run the app directly and manage Supabase local services through the project CLI:

```bash
pnpm dev
pnpm supabase start
pnpm supabase status
pnpm supabase stop
```

Docker Desktop must be running before `pnpm supabase start`.

## Quality Commands

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Documentation

- [MVP scope](docs/MVP_SCOPE.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Security](docs/SECURITY.md)
- [Database](docs/DATABASE.md)
- [Accessibility](docs/ACCESSIBILITY.md)
- [Word (.docx) export](docs/DOCX_EXPORT.md)
- [Testing](docs/TESTING.md)
- [CI/CD](docs/CI_CD.md)
- [Docker](docs/DOCKER.md)
- [AI workflow](docs/AI_WORKFLOW.md)
- [Product rules](docs/PRODUCT_RULES.md)

## Current Status

The MVP currently includes private-pilot Auth, Workspaces with four roles (`propietario`, `administrador`, `asistente`, `solo_lectura`), profile/document/workspace settings, clients, reusable templates, persistent escrituras, in-memory Word export, document lifecycle and activity, internal notarial index preparation, accounts receivable, payments, RLS, and focused E2E coverage. Vercel Production and Supabase Cloud exist; their dated operational state is documented separately and changes require explicit authorization.

## Non-Negotiables

- Do not store generated Word/PDF files, signed documents, official submissions, or generated document storage paths.
- Treat persistent Escritura data (`field_values`, `rendered_content`, and `template_snapshot`) as sensitive workspace data: protect it with RLS, avoid logs, and store only what is needed for the approved workflow.
- Do not expose Supabase service role keys to client-side code.
- Enforce Workspace membership and role authorization with Supabase RLS before handling real user data.
- Keep security, accessibility, and data minimization visible in every feature review.

## Architecture

The current architecture and incremental modularization plan are documented in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Structural refactors must remain
behavior-preserving and must not introduce strict Clean Architecture layers by
default.

## TODO

- Continue enforcing existing `src/features` boundaries as modules evolve.
- Keep Production runbooks and migration state current after explicitly authorized releases.
