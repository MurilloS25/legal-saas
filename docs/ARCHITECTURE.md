# Architecture

## Overview

This application is a modular monolith built with:

- Next.js App Router.
- TypeScript.
- Tailwind CSS.
- Supabase.
- Docker for local development support.
- GitHub Actions for CI.
- Vercel plus Supabase Cloud as the intended MVP production target.

The architecture is inspired by Clean Architecture, but adapted to a practical Next.js MVP.

The goal is to keep the system simple enough to build quickly while preserving clear boundaries for business rules, data access, document generation, security, and UI.

## Architectural Decision

The MVP will be built as a modular monolith.

This means:

- One repository.
- One deployable Next.js application.
- Clear internal modules.
- No microservices.
- No separate backend service for the MVP.
- Supabase provides managed backend services such as Auth and Postgres.

## Production Target

The intended MVP production architecture is:

```txt
User
  ↓
Vercel - Next.js application
  ↓
Supabase Cloud - Auth, Postgres, RLS
```

Docker is not required for MVP production deployment.

Docker is used for local development support, especially for Supabase local services.

## Local Development Target

The intended local development architecture is:

```txt
Developer machine
  ├─ VS Code
  ├─ Claude Code / Codex
  ├─ Next.js app
  └─ Docker
      └─ Supabase local stack
          ├─ Postgres
          ├─ Auth
          ├─ Storage
          └─ Studio
```

## Source Layout

```txt
src/
├─ app/
├─ components/
├─ domain/
├─ application/
├─ infrastructure/
├─ features/
└─ lib/
```

## Folder Responsibilities

### `src/app`

Contains Next.js App Router files:

- Routes.
- Layouts.
- Pages.
- Route handlers.
- Metadata.
- Loading and error boundaries.

This layer should compose features and use cases, not contain core business rules.

### `src/components`

Contains shared UI primitives and reusable components:

- Layout components.
- Form components.
- UI building blocks.
- Accessible shared elements.

Components here should be generic and reusable.

### `src/domain`

Contains pure business language and rules.

Examples:

- Template field concepts.
- Document metadata concepts.
- Client role concepts.
- Receivable status concepts.
- Notarial index period rules.

Domain code must not import:

- React.
- Next.js.
- Supabase.
- Browser APIs.
- Infrastructure code.

### `src/application`

Contains use cases and orchestration.

Examples:

- Create client.
- Update lawyer profile.
- Create template.
- Generate document data.
- Register notarial metadata.
- Mark receivable as paid.

Application code may depend on domain contracts, but should not depend directly on concrete infrastructure details.

### `src/infrastructure`

Contains adapters and external service implementations.

Examples:

- Supabase clients.
- Repository implementations.
- Document generation adapters.
- Future storage adapters.
- External service integrations.

Infrastructure implements contracts needed by application use cases.

### `src/features`

Contains feature-level composition.

Examples:

- `features/clients`
- `features/templates`
- `features/documents`
- `features/notarial-index`
- `features/receivables`
- `features/settings`

A feature may combine UI, forms, hooks, server actions, and use case calls for a specific product area.

### `src/lib`

Contains shared utilities:

- Validation helpers.
- Constants.
- Formatting helpers.
- General utilities.

Avoid putting product business rules here if they belong in `domain`.

## Dependency Direction

The dependency direction should be:

```txt
app/features/components
        ↓
application
        ↓
domain
```

Infrastructure is used through contracts and adapters.

Domain must remain independent.

## Data Access

Supabase access should be centralized.

Avoid direct Supabase calls scattered across UI components.

Preferred approach:

```txt
Route / Server Action
  ↓
Application use case
  ↓
Repository contract
  ↓
Supabase repository implementation
```

## Authentication

Supabase Auth will be used for user authentication.

Protected routes must verify that the user is authenticated before showing private dashboard content.

Authorization must not rely only on frontend checks.

## Authorization

Supabase Row Level Security is mandatory for user-owned data.

Every user-owned table must include an ownership model, usually `owner_id`.

Base rule:

```sql
owner_id = auth.uid()
```

Policies must be tested with positive and negative cases.

## Data Model Principles

The data model must follow these principles:

- Store only what is required.
- Avoid storing generated legal documents.
- Avoid storing full sensitive escritura content.
- Separate templates from generated document metadata.
- Separate notarial index metadata from accounts receivable.
- Keep client metadata reusable but minimal.
- Add audit logs only where they provide clear security or operational value.

## Document Generation Architecture

The intended flow is:

```txt
Template definition
  ↓
Template fields
  ↓
Generation form
  ↓
Validated input
  ↓
Resolved document data
  ↓
DOCX generation adapter
  ↓
Download
  ↓
Discard generated file from application memory/storage
```

Generated legal documents are not stored by the application.

The initial required output is editable Word format.

PDF export is deferred unless explicitly approved later.

## Template Architecture

Templates should not be stored only as raw HTML.

The preferred model should support:

- Structured content.
- Variables.
- Required fields.
- Optional fields.
- Simple conditional blocks.
- Repeated party roles when needed.
- Text preview for display/search.

The final schema will be defined in `docs/DATABASE.md`.

## Docker Decision

Docker is used for local development support.

Docker is not part of the MVP production hosting path.

The project may include:

- `Dockerfile` for portability and future optional container builds.
- `docker-compose.yml` for local development helpers.
- `.dockerignore` for clean Docker contexts.

The MVP production target remains Vercel plus Supabase Cloud.

## CI/CD

GitHub Actions should validate:

- Dependency installation.
- Lint.
- Typecheck.
- Unit tests.
- Build.

Future production deployment may be handled by Vercel connected to GitHub.

## Branching Strategy

Recommended branches:

```txt
main
develop
feature/*
fix/*
docs/*
```

Rules:

- `main`: production-ready code.
- `develop`: integration branch.
- feature branches: created from `develop`.
- pull requests required before merging to `develop`.
- stable `develop` can be merged into `main`.

## Testing Strategy

Use:

- Vitest for unit tests.
- Playwright for E2E tests.
- TypeScript for static validation.
- ESLint for code quality.

Critical business logic requires tests.

## Accessibility Architecture

Accessibility is part of the architecture.

All form-heavy flows must support:

- Labels.
- Keyboard navigation.
- Visible focus.
- Clear errors.
- Logical tab order.
- Accessible dialogs and menus.

## Security Architecture

Security is part of the architecture.

Required principles:

- Data minimization.
- RLS from the first production schema.
- Server-side authorization checks.
- No service role key in browser code.
- No generated document storage.
- Input validation.
- Safe logging.
- OWASP Top 10 review mindset.

## Initial Route Plan

The initial dashboard route groups may later include:

```txt
src/app/(auth)/
src/app/(dashboard)/
```

Dashboard areas may include:

```txt
clients/
templates/
documents/
index/
receivables/
settings/
```

These should not be implemented until the related feature task is approved.

## Open Architecture Questions

- Which document generation library will be selected first?
- What exact template structure will be stored?
- What exact notarial index metadata is required?
- Which audit events are required in the MVP?
- Which flows require E2E coverage first?
