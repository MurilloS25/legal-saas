# RLS Verification

> **Historical scope.** This document records the manual verification approach
> for the first migration. It is not the current complete authorization
> runbook. Current Workspace/role behavior is covered by the versioned pgTAP
> suites in `supabase/tests`; run them locally with `pnpm supabase db test`.

## Purpose

This document explains how to verify the first Supabase migration's Row Level Security behavior in local development.

The verification is intentionally local-only and uses fake test data. It must not be run against Supabase Cloud or production data.

## Scope

The current verification covers the initial MVP tables:

- `lawyer_profiles`
- `document_settings`
- `clients`
- `templates`
- `template_fields`
- `receivables`

The initial migration also created `document_metadata` and `notarial_records`.
They were unused scaffolding and were removed from the current schema by
`20260915040113_remove_legacy_notarial_tables.sql`, so this current-state suite
no longer creates fixtures or asserts policies for them.

It verifies that:

- User A can create and read their own records.
- User A cannot read User B records.
- User A cannot create records using User B's `owner_id`.
- User A cannot create child records under User B parent records.
- User A cannot update `owner_id` to transfer ownership.
- Anonymous users cannot read or insert private user-owned data.

## How It Works

The pgTAP test file is:

```txt
supabase/tests/rls_initial_schema.test.sql
```

The test:

- Inserts fake local users into `auth.users`.
- Sets local JWT claims with `request.jwt.claim.sub`.
- Switches between the local `authenticated` and `anon` Postgres roles.
- Uses only fake data with `.example.test` addresses and placeholder identification numbers.
- Runs inside a transaction and rolls back at the end.

## Run Locally

Start from a clean local database:

```bash
pnpm supabase db reset
```

Run the RLS verification:

```bash
pnpm supabase test db --local supabase/tests/rls_initial_schema.test.sql
```

The test should finish with all assertions passing.

## Rules

- Do not use real lawyer data.
- Do not use real client data.
- Do not use real identification numbers.
- Do not paste or commit secrets.
- Do not run this verification against Supabase Cloud.
- Do not use `supabase db push` for RLS verification.

## When To Update

Update this verification when:

- A user-owned table is added.
- A relationship between user-owned tables changes.
- An RLS policy changes.
- A new child table needs parent ownership validation.
- Anonymous access expectations change.
