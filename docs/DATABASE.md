# Database

## Current State

No application tables are defined yet. This is intentional: schema design should happen as a separate task after the MVP metadata boundaries are reviewed.

## Planned Platform

- Supabase Postgres for persistent data.
- Supabase Auth for users.
- Row Level Security for every table containing user-owned data.
- SQL migrations committed to the repository once schema work begins.

## Data Minimization Rules

- Store only structured metadata needed for client reuse, notarial index preparation, and accounts receivable.
- Do not store generated legal documents.
- Do not store full sensitive escritura content.
- Avoid free-text fields that invite sensitive legal narrative unless explicitly justified.

## Future Candidate Areas

- Profiles or account settings.
- Clients.
- Templates.
- Template versions.
- Document-generation metadata.
- Notarial record metadata.
- Receivables.

These are candidates, not approved tables.

## TODO

- Define tenant/user ownership model.
- Draft RLS policy conventions.
- Decide migration tooling and naming conventions.
