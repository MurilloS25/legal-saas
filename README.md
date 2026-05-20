# Legal Docs SaaS

MVP foundation for a legal productivity SaaS for independent lawyers in Costa Rica.

The product will help lawyers manage reusable legal document templates ("machotes") and structured metadata for clients, notarial index preparation, and accounts receivable. The MVP must not store generated legal documents or full sensitive escritura content.

## Stack

- Next.js App Router with TypeScript, Tailwind CSS, ESLint, and `src/`
- Supabase for Auth, Postgres, and future RLS-based authorization
- Vercel for production hosting
- Docker only for local development support, mainly alongside the Supabase local stack
- Modular monolith with Clean Architecture-inspired boundaries
- GitHub Actions CI and Dependabot updates
- Vitest and Playwright reserved for focused tests as features are added

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
- [Testing](docs/TESTING.md)
- [CI/CD](docs/CI_CD.md)
- [Docker](docs/DOCKER.md)
- [AI workflow](docs/AI_WORKFLOW.md)
- [Product rules](docs/PRODUCT_RULES.md)

## Current Status

This repository is intentionally at foundation stage. Product screens, database tables, document-generation logic, and production deployment configuration are deferred.

## Non-Negotiables

- Do not store generated legal documents.
- Do not store full sensitive escritura content.
- Do not expose Supabase service role keys to client-side code.
- Enforce per-user authorization with Supabase RLS before handling real user data.
- Keep security, accessibility, and data minimization visible in every feature review.

## TODO

- Define the first database schema and RLS policies.
- Add Supabase client/server helpers.
- Add Vitest and Playwright configurations when the first testable behavior exists.
- Add Vercel project and environment configuration.
