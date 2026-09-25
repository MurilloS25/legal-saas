# Architecture

## Architectural Decision

LexCR is a feature-oriented modular monolith built on the Next.js App Router.

The application remains:

- One repository.
- One deployable Next.js application.
- One Supabase backend for Auth and Postgres.
- Vercel plus Supabase Cloud as the intended production target.
- Supabase CLI plus Docker as the local development environment.

The project does not adopt strict Clean Architecture. It uses pragmatic module
boundaries where they improve maintainability, security, and testability, but it
does not require ceremonial layers, generic repositories, or interfaces for
every database operation.

The architecture is optimized for:

- A maintainable MVP serving an initial group of approximately 10-20 clients.
- Clear feature ownership and safe incremental refactoring.
- Multi-user security through server-side authorization and Supabase RLS.
- Fast development without hiding business rules inside route or UI code.
- Testable pure logic and explicit external integration boundaries.

It is not optimized for microservices, multiple databases, distributed
infrastructure, millions of users, or hypothetical abstractions.

## Runtime Architecture

Production:

```txt
User
  -> Vercel (Next.js)
  -> Supabase Cloud (Auth, Postgres, RLS)
```

Local development:

```txt
Developer machine
  |- Next.js application
  |- Supabase CLI
  `- Docker Desktop
      `- Supabase local stack
```

Docker is local development support. It is not the MVP production hosting
strategy. Supabase Cloud must not be touched without explicit authorization.

## Current State

The application is organized primarily below `src/features`, with `src/app`
responsible for App Router routes, layouts, Route Handlers, boundaries and
composition. Feature modules contain their product-specific UI, models, hooks,
queries, validations and Server Actions and expose intentional public entry
points. Route-private components and helpers remain colocated when they belong
only to one screen, such as the dashboard summary blocks and presenters.

The former `src/domain`, `src/application`, and `src/infrastructure`
placeholder trees were removed because they did not represent the implemented
architecture. `src/features` remains the destination for feature modules; new
directories are created only when concrete code requires them.

## Source Layout

```txt
src/
|- app/
|  |- (auth)/
|  |- (dashboard)/
|  `- api/
|- features/
|  |- clients/
|  |- documents/
|  |- templates/
|  |- notarial-index/
|  |- receivables/
|  `- settings/
|- components/
|  |- document/
|  |- feedback/
|  |- forms/
|  |- layout/
|  |- navigation/
|  |- ui/
|  `- workspace/
`- lib/
   |- supabase/
   |- editor/
   |- documents/
   |- forms/
   |- navigation/
   |- server/
   |- validation/
   `- validations/
```

This diagram describes the implemented conceptual structure. It is not a
folder checklist: create only directories justified by concrete code.

## Responsibility Of `src/app`

`src/app` should contain primarily:

- `page.tsx`, `layout.tsx`, `loading.tsx`, and `error.tsx` files.
- Route Handlers.
- Screen composition and route-level metadata.
- Reading and normalizing route parameters.
- Wiring between feature modules.
- Components or helpers that are genuinely specific to one route.

`src/app` should not be the default home for:

- Complex or shared Supabase queries.
- Reusable business rules and validators.
- Shared formatters.
- Server Actions used as internal feature implementation.
- Components reused by another feature.
- Integrations imported by a different route or Route Handler.

Pragmatic rule:

> Code specific to one route may remain near that route. Reusable, business, or
> shared feature code belongs outside `app`.

### Composition Roots

`app` is the correct owner when a screen integrates several features and none
of them should own the complete workflow. For example,
`clients/[id]/page.tsx` composes Clients, Documents and Receivables into one
client-detail screen through their public APIs.

Do not move every integration into `app`. When a relationship is part of one
feature's own workflow, that feature keeps the composition. Documents, for
example, owns its receivable step and its notarial-index inclusion controls,
while consuming the corresponding public feature contracts.

## Feature Modules

A feature owns the UI, model, and server behavior for one product capability.
A feature may use a structure such as:

```txt
src/features/receivables/
|- components/
|- model/
|  |- schemas.ts
|  |- types.ts
|  |- filters.ts
|  `- money.ts
|- server/
|  |- workspace-queries.ts
|  |- detail-queries.ts
|  |- payment-actions.ts
|  `- options-queries.ts
`- index.ts
```

Not every feature needs every folder. A small feature can contain only the
directories and entry points required by its responsibilities. Consistency
means stable boundaries and dependency direction, not artificial symmetry.

### Public Feature APIs

Each current feature exposes a small `index.ts` as its repository-internal
public API for UI and client-safe model contracts. Server-only queries,
mutations and export preparation are exposed separately through `server.ts`,
which starts with `import "server-only"`.

```ts
export { ReceivableMiniList } from "./components/ReceivableMiniList";
```

```ts
// features/receivables/server.ts
import "server-only";

export { listReceivablesByClient } from "./server/detail-queries";
```

Consumers use only the symbols intentionally exported:

```ts
import { ReceivableMiniList } from "@/features/receivables";
import { listReceivablesByClient } from "@/features/receivables/server";
```

Do not export every internal symbol. The entry point is a boundary, not a giant
barrel file.

`features/templates/domain.ts` is a deliberate additional contract. It exports
pure template types and transformations without React or `server-only`, so
Documents can reuse the Machote document model, variables and Option Block
rules without importing Templates internals. Do not generalize this exception
into a barrel for every feature.

## Feature Ownership

- **Clients:** client data, validation, lifecycle and client-specific UI.
- **Documents:** Escrituras, editing and lifecycle, immutable historical
  Machote snapshots, DOCX generation, and inclusion of an Escritura in the
  Notarial Index.
- **Templates:** Machotes, variables, Option Blocks, autofill and reusable
  template configuration.
- **Notarial Index:** notarial metadata and mappings, template-level notarial
  configuration, confirmation and correction, workspace review, and export.
- **Receivables:** Cobros, payments and their financial lifecycle.
- **Settings:** profile presentation, workspace/Despacho settings, team
  members and invitations.

## Import Rules

Allowed:

- `app -> features`, through `index.ts`, `server.ts` or an explicitly documented
  pure contract such as `templates/domain.ts`.
- `app -> components` and `app -> lib`.
- `features -> components` and `features -> lib`.
- A feature imports another feature through its public API when there is a real
  domain relationship.
- Internal feature code uses relative imports within that feature.

Avoid:

- `lib -> features` in runtime code.
- Shared `components -> features`.
- `features -> app`.
- Deep imports into another feature's private structure.
- Imports from one route implementation into another route.
- Circular feature dependencies.
- Importing server-only modules from Client Components.
- Re-exporting unrelated modules through a global barrel.

Shared pure code must not import from `app` or feature implementations.
Server-only feature entry points use `server-only` to protect the client/server
boundary. Tests that compare a shared engine with a legacy feature contract may
form a test-only compatibility edge; that edge must not enter runtime code.

## Shared Code

Use `src/components` only for UI that is genuinely reusable across features.
Feature-specific UI belongs in the feature.

Use `src/lib` for stable shared capabilities and pure engines, including:

- Supabase client construction and typed server authentication helpers.
- Authentication, permissions, errors and other server helpers.
- The structured editor and variable processing engine.
- DOCX generation and document transformations.
- Navigation, pagination and shared form-state contracts.
- Shared parsing, formatting, and validation primitives.

Do not turn `lib` into a miscellaneous folder. Product behavior used by only one
module should remain in that feature's `model` or `server` directory.

## Pragmatic SOLID

### Single Responsibility

Separate real reasons to change: queries, mutations, pure rules, validators,
formatters, components, and external integrations. File length is a signal, not
the reason by itself to split a file.

### Open/Closed And Substitution

Create extension points or interchangeable implementations only when a real
requirement exists. Do not predict every future provider or build artificial
inheritance hierarchies.

### Interface Segregation

Prefer small contracts that expose only what a consumer needs. Feature entry
points follow the same rule.

### Dependency Inversion

Pure business and transformation logic must not depend on React, Next.js,
routes, visual components, or concrete browser behavior. Do not create an
interface for every Supabase query merely to claim dependency inversion.

## Interfaces And Dependency Injection

Create an interface when at least one condition applies:

1. There are multiple real implementations.
2. An important external integration needs isolation.
3. A boundary must be replaceable in focused tests.
4. Modules share a stable contract.
5. An adapter is genuinely substitutable.

A document exporter is a reasonable interface. A generic repository that only
copies Supabase CRUD methods is not.

The project will not use a dependency injection container. Prefer explicit
function parameters and small dependency objects when they improve testing or
decoupling. Simple Server Actions may import server-only feature functions
directly. Prefer composition over inheritance.

## Supabase Boundaries

The implemented foundation includes generated database types, typed browser
and server clients, request-scoped authentication through `requireUser()`,
permission helpers and typed server errors. Routes add error boundaries where
the screen needs specific recovery behavior. New code should extend these
foundations instead of creating route-local authentication or untyped database
access.

These foundations preserve:

- RLS as the primary data authorization control.
- Explicit server-side Workspace membership and permission checks as defense in depth.
- Zod validation at trust boundaries.
- No service role key in browser code.
- Versioned migrations and local RLS tests for database changes.

## Data And Document Boundaries

The system may persist validated Workspace-owned `field_values`, rendered text
and minimal structured Machote snapshots for the approved Escritura workflow.
It must not store generated
Word/PDF files, signed documents, official submissions, or generated document
storage paths.

DOCX files are generated server-side in memory through
`src/lib/documents/docx`, returned as downloads, and discarded. The document
model and variable renderer remain shared rather than duplicated by export
code. See `docs/DOCX_EXPORT.md`.

## Current Workspace Flows

Authenticated application routes share the existing `(dashboard)` route-group
layout. The group name is organizational and does not appear in URLs. `/dashboard`
is the overview only; feature workspaces use the canonical top-level paths
`/clients`, `/templates`, `/documents`, `/notarial-index`, `/receivables`, and
`/settings`. Compatibility redirects keep former `/dashboard/<module>` bookmarks
working while preserving nested IDs and query parameters.
The root `/` is the public landing page. Auth screens live under the `(auth)`
route group while retaining stable public URLs such as `/login`,
`/accept-invite` and `/reset-password`; `src/proxy.ts` owns the authenticated
route boundary rather than physical nesting below `/dashboard`.

- The dashboard shell uses a desktop top navbar and a mobile drawer. Account
  actions open Perfil, Configuración or Despacho; team management is part of
  Despacho and remains permission-gated.
- "Crear con IA" (`POST /api/templates/ai-generation`, a Route Handler so
  the upload body limit stays scoped to that route) creates a draft Machote
  and then opens this same stepper. Generic document text extraction lives
  in `src/lib/documents/extraction`; provider abstraction, prompt,
  validation and draft reconstruction live in
  `features/templates/{model,server}/ai-generation`. See
  `docs/AI_TEMPLATE_GENERATION.md`.
- Machotes use Información → Documento → Variables → Índice → Publicar. One
  persistent Guardar action coordinates the workspace without auto-advancing.
  Option Blocks contribute variables from every variant to the global catalog;
  structured time mapping belongs to Índice configuration rather than the
  Option Block dialog.
- Escrituras use Completar → Cobro → Índice. `Revisar y finalizar` is not a
  step: preview is part of Completar and Finalizar/Reabrir are lifecycle actions
  in the persistent action dock. Download, history and duplication remain
  header utilities. When finalized, the same dock saves the Índice data
  (`NotarialMetadataSection` reports a `NotarialDockState`) and offers
  "Confirmar Índice" as a lifecycle action; content and Índice edits never
  coexist because the Índice is only editable once the Escritura is final.
- The persistent action dock (`WorkspaceActionDock`) reserves exactly its
  measured height (ResizeObserver) at the end of the page and sets
  `scroll-padding-bottom`, so it never covers page controls when its actions
  wrap on narrow screens or when a control is scrolled into view.
- Dirty-state revisions prevent an older save response from marking newer edits
  clean. A shared navigation guard covers app links, account navigation, logout
  and `beforeunload`; browser back/forward remains subject to the App Router's
  non-cancelable history behavior.
- Document saves and finalization use optimistic concurrency based on the
  expected `updated_at`. Each new Escritura captures an immutable structured
  Machote snapshot used by preview, later edits, finalization and DOCX. Snapshot
  version 2 also freezes the Machote name and minimal notarial mapping in stable
  field keys, so later Machote edits do not change the historical Index view.

## State And Data Libraries

### TanStack Table: Adopted For Core Listings

The Notarial Index pilot proved the pattern: TanStack Table manages columns,
visibility, row selection, expansion, visual ordering, and controlled table
state, while the server remains responsible for searching, data filters,
pagination, security, and export.

Following an explicit audit that found the non-TanStack listings (Escrituras,
Machotes, Clientes) implemented their column alignment with duplicated CSS
Grid definitions between the header and each row — two independent grid
containers that size `auto` tracks (notably the actions column) from their own
content only, causing header/row misalignment whenever action content varies
per row — those listings were migrated to TanStack Table as well (Escrituras,
Machotes, Clientes, Cuentas por cobrar). Each keeps the header and body
rendered from the same `getHeaderGroups()`/`getVisibleCells()` model, so the
column count and alignment can no longer drift between header and rows.

Clientes, Machotes, Escrituras, Cuentas por cobrar and Índice Notarial are all
server-paginated. They keep `manualPagination` and delegate result-set
pagination to normalized PostgREST count/range queries. Filters and sorting are
also server-side where each workspace exposes them. The current URL source of
truth uses `page` and the normalized `pageSize` whitelist (5, 10, 25 or 50;
default 10). Changing the size or a relevant filter returns to page 1, while
navigation preserves filters and ordering. TanStack Table owns presentation
state, not data loading.

Do not install or migrate additional listings to TanStack Table outside an
explicit task with acceptance criteria. Timelines, activity feeds, and other
non-columnar lists (for example document/receivable activity, payments,
template variables) remain plain lists — they are not tabular data and do not
need TanStack Table.

### TanStack Query: Evaluate Later

Consider it only for concrete interactive server-state needs such as incremental
history, payment refresh, invalidation, or updates without navigation. It must
not replace Server Components or Server Actions by default and must not create a
second source of truth.

### Zustand: Do Not Adopt Now

Consider Zustand only if real global client state appears. Do not use it for
Supabase data, local forms, server-side filters, or state already owned by
TanStack Query.

### TanStack Router: Do Not Adopt

Next.js App Router remains the only application router.

## Filter State Policy

Use a hybrid policy.

Store in the URL:

- Current page.
- Applied search.
- Filters that change the server result set.
- Date ranges, status, currency, and sort order.
- Parameters that affect export output.

Keep in local component state:

- Search text before it is applied.
- Open or collapsed panels.
- Tabs and mobile presentation choices.
- Row selection, expanded rows, and visible columns.
- Other visual-only options.

If TanStack Table is introduced, it may own controlled visual table state. If
TanStack Query is introduced, query keys must mirror already normalized,
applied filters; query keys are not an independent filter store.

## Removed Placeholder Directories

The unused `src/domain`, `src/application`, and `src/infrastructure` trees were
removed after the feature-based architecture was adopted. Do not recreate
empty architectural layers or generic repository placeholders. Add a concrete
directory only when implemented code has a real responsibility there.

## Final Boundary Verification

The architecture closure review after the feature extractions found:

- No runtime dependency from `lib` or shared `components` into a feature.
- No circular dependencies.
- No deep imports into another feature's private folders.
- No imports between route implementations; route-private dashboard modules
  remain inside their own composition root.
- UI-consumed action state belongs in pure model/form modules rather than being
  declared by Server Action files.
- Empty placeholder files are not used to manufacture a symmetric structure.

Two editor tests retain test-only compatibility imports from the Templates
public API. They compare the shared structured editor with legacy template
behavior and do not alter the runtime graph. Relocating them is optional and
should happen only if those legacy comparisons are reorganized for a concrete
testing reason.

## Pull Request Rules For Refactors

- Keep one principal reason for change per PR.
- Separate structural moves from behavior changes whenever practical.
- Do not combine architecture, SQL, UI redesign, and new libraries in one PR.
- A behavior-preserving PR may move many files when tests prove equivalence.
- Use at most three stacked branches in one iteration.
- After each stack is integrated, return to an updated `develop` before the next
  stack.

Example of a future stack, not branches to create now:

```txt
develop
`- refactor/supabase-typed-foundations
   `- refactor/server-auth-and-errors
      `- refactor/receivables-feature-module
```

## Historical Incremental Migration Plan

The following sequence records the modularization plan that led to the current
feature-based structure. Foundations, core feature extraction, TanStack Table,
generated Supabase types and the first hardening passes are implemented. It is
history and must not be read as a current backlog.

1. **Architecture decision:** align documentation without moving code.
2. **Foundations:** generated Supabase types, typed clients, `requireUser()`,
   typed errors, and route error boundaries.
3. **Receivables pilot:** separate model, workspace/detail/options queries,
   payments, components, and a small feature entry point.
4. **Documents:** move queries/actions behind the feature boundary and divide
   `DocumentComposer` by responsibility without changing behavior.
5. **Templates:** first make template-and-field saves transactional; then split
   workspace/editor responsibilities.
6. **Smaller features:** migrate Clients, Notarial Index, and Settings; remove
   deep route-to-route imports.
7. **TanStack Table pilot:** adopt it in the Notarial Index while keeping data
   operations server-side.
8. **Output workflows:** automate index preparation and improve real Word
   formatting within existing privacy boundaries.
9. **TanStack Query evaluation:** test one concrete interactive server-state
   workflow before broader adoption.
10. **MVP hardening:** versioning, controlled reopening, reliability, and UX
    polish.

Each phase must preserve behavior, security, accessibility, and relevant unit,
RLS, build, and E2E coverage. A failed or oversized phase should be reduced,
not solved by a repository-wide rewrite.

## Product and UX operational debt

The public landing route and global `not-found.tsx` are implemented. Custom
SMTP, the definitive production domain and transactional email templates remain
operational debt and require a separate product/release decision.

## Unsaved workspace navigation

The dashboard's `NavigationGuardProvider` owns the shared leave confirmation.
Document, template, and notarial metadata editors register unsaved state with
`useUnsavedChanges`. App-controlled imperative navigation and logout use
`requestLeave`; same-origin links leaving the current pathname are captured
centrally. Internal workspace steps, new-tab links, and downloads remain free.
Reload/tab close use the browser's `beforeunload` confirmation. App Router
does not expose a cancellable back/forward hook: same-document browser history
traversal is not intercepted, and the History API is not patched. Future
imperative exits from these editors must use the shared guard.

## What Must Remain Stable

- Next.js App Router, Server Components, and Server Actions.
- Supabase Auth, Postgres, and RLS ownership rules.
- Server-side authorization and validated user input.
- Existing pure editor, document, lifecycle, and receivable logic with tests.
- In-memory DOCX generation without generated-file storage.
- Server-side list filtering and pagination.
- Accessible UI and high-value Playwright flows.

Architecture changes must remain incremental, reversible, and demonstrably
behavior-preserving.
