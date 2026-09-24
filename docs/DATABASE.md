# Database Design

## Status

This document tracks the MVP database model and approved migration decisions.

Do not create new tables, migrations, seed files, or Supabase Cloud resources from this document unless the task explicitly asks for a database change.

The database target is Supabase Postgres with Supabase Auth and Row Level Security.

## MVP Database Decisions

- Supabase Auth is the source of truth for application users.
- Every user-owned application table in the first migration includes `owner_id uuid not null references auth.users(id)`.
- RLS is required for every user-owned table before the table is used by product code.
- Users can only access their own records.
- Child records must validate ownership consistency with parent records.
- Anonymous users must not access private user-owned data.
- Generated Word files, PDFs, signed documents, official submission payloads, and storage paths for generated documents are intentionally excluded.
- Persistent draft escrituras may store validated `field_values`, a server-rendered `rendered_content` text snapshot, and the minimal structured `template_snapshot` needed to keep that Escritura editable against its creation version.
- Persistent draft text is sensitive user-owned data and must be protected by RLS, validation, and no-content logging rules.
- The first migration focuses on independent lawyers and physical-person clients.
- Company clients, legal representatives, audit events, and independent notes are deferred.
- The database stores only data required for lawyer profile settings, clients, templates, persistent draft escrituras, notarial index preparation, and basic receivables.
- The initial schema's unused `document_metadata` and `notarial_records` scaffolding was removed by `20260915040113_remove_legacy_notarial_tables.sql`; the operational models are `documents` and `document_notarial_metadata`.
- Accounts receivable is intentionally basic. It includes payment records and
  payment voiding/activity, but not formal accounting, tax calculation or
  electronic invoicing.
- This document describes approved schema decisions and future candidate fields. New migrations still require an explicit task.

## Database Goals

The MVP database must support:

- Multiple independent lawyers.
- Lawyer profile data.
- One default document formatting configuration per lawyer.
- Physical-person and legal-entity (sociedad) client metadata.
- Template management.
- Template variable and field definitions.
- Persistent draft escrituras.
- Optional document metadata for index and/or receivable workflows.
- Structured notarial index metadata preparation.
- Basic accounts receivable.

The database must avoid storing:

- Generated `.docx` or PDF files.
- Storage paths for generated legal documents.
- Signed documents.
- Official submission payloads.
- Full escritura text outside the approved persistent draft workflow.
- Secrets or credentials.
- Unnecessary legal transaction detail.
- AI prompts, AI responses, AI source documents, or AI legal advice content.
  `ai_template_generations` stores operational metadata only (see below).

## First Migration Scope

Historical tables created by the first migration:

- `lawyer_profiles`
- `document_settings`
- `clients`
- `templates`
- `template_fields`
- `document_metadata`
- `notarial_records`
- `receivables`

`document_metadata` and `notarial_records` were never consumed by application code and were later removed. `documents` and `document_notarial_metadata` are the current operational tables.

Explicitly excluded from the first migration:

- Company clients.
- Legal representatives.
- `audit_events`.
- Independent notes module.
- Generated document storage.
- AI features.
- Supabase Storage buckets for generated legal documents.
- Dynamic complex party lists.
- Partial-payment detail table.

### Document Draft Persistence Migration Scope

The later document draft persistence migration adds:

- `documents`

It must not add:

- Generated Word/PDF file storage.
- Signed document storage.
- Official submission payloads.
- Storage paths for generated legal documents.

## Proposed Tables

### `lawyer_profiles`

Purpose:

Stores the authenticated lawyer's basic professional profile for account settings and document personalization.

Candidate fields:

```txt
id
owner_id
full_name
professional_code
email
phone
created_at
updated_at
```

Relationships:

- `owner_id` references `auth.users(id)`.
- Usually one profile per owner.

Sensitive data:

- Contains personal and professional contact data.
- Does not store official credentials, signatures, identity scans, authentication secrets, or service role keys.

Ownership rule:

- The owner is the authenticated user identified by `owner_id`.

RLS need:

- Required. Users can only select, insert, update, and delete their own profile.

Pending questions:

- Confirm the exact professional code field required for Costa Rica lawyers/notaries.
- Decide whether profile email should duplicate Supabase Auth email or be an editable contact email.

### `document_settings`

Purpose:

Stores the lawyer's default formatting preferences for generated Word documents. Consumed by every DOCX generator (Escrituras, Índice Notarial) through `resolveDocumentFormatting` — see `docs/DOCX_EXPORT.md`. Paper size is not part of this table: it is a fixed product default (Legal, 8.5 × 14 in), not a per-lawyer preference.

Decision:

- One default configuration per lawyer.
- No named presets in the MVP.
- Margins have two independent profiles: **Frente** (`margin_*_cm`) and **Vuelto** (`back_margin_*_cm`). The `back_*` columns are nullable, all-or-none, and NULL on rows saved before the split (the app then uses the Frente margins for Vuelto). See `docs/DOCX_EXPORT.md`.
- `line_spacing` is no longer a preference (the DOCX always uses exactly 24 pt); the column is kept with a default (1.5) for compatibility and is unused.

Candidate fields:

```txt
id
owner_id
font_family
font_size
margin_top_cm
margin_bottom_cm
margin_left_cm
margin_right_cm
back_margin_top_cm
back_margin_bottom_cm
back_margin_left_cm
back_margin_right_cm
line_spacing
created_at
updated_at
```

Relationships:

- `owner_id` references `auth.users(id)`.
- One active settings record per owner in the MVP.

Sensitive data:

- Low sensitivity. Mostly formatting preferences.

Ownership rule:

- The owner is the authenticated user identified by `owner_id`.

RLS need:

- Required. Users can only manage their own document settings.

Pending questions:

- Confirm default legal document formatting values with target users.
- Decide later whether named presets are needed after MVP.

### `clients`

Purpose:

Stores reusable client metadata for physical persons and legal entities
(sociedades).

Decision:

- `identification_type` allows `cedula_fisica` (persona física) and
  `cedula_juridica` (persona jurídica / sociedad) — migration
  `20260923180000_clients_legal_entity_and_autofill_sources`.
- A legal entity stores only razón social (`full_name`), cédula jurídica
  (`identification_number`) and domicilio (`exact_address`).
  `marital_status`, `nationality` and `occupation` are nullable columns;
  `clients_person_fields_by_type_check` requires them for `cedula_fisica`
  and requires them to be `NULL` for `cedula_juridica` (a sociedad never
  carries personal data that autofill could copy into an Escritura).
- Identification format: `cedula_fisica` is stored without hyphens or spaces
  (unchanged). `cedula_juridica` is stored exactly as typed, hyphens included
  (`3-101-123456`); the only normalization is trimming and removing spaces
  around a hyphen. Accepted: digit groups separated by single hyphens, or
  digits only, max 30 characters (`clients_juridica_identification_format_check`
  enforces the pattern in the database). No fixed length or grouping is
  imposed because the project has no referenced official rule.
- Changing a client from física to jurídica clears the three personal fields
  on save; the edit form warns before saving when data would be removed.
- Legal representatives, personería, poderes, juntas directivas, capital and
  registry data are deferred; representation inside an Escritura is handled
  with separate roles/Clients.
- `email` and `phone` are not first-migration fields.
- `notes` is not a first-migration field.

Autofill (`template_fields.autofill_source`) can copy: `client_full_name`,
`client_identification`, `client_address`, `client_marital_status`,
`client_occupation`, `client_nationality`. The last three never apply to a
legal entity (the Escritura value is left untouched, never invented).

Known limitation — transforms and hyphens: the `digits_to_words` output
transform treats hyphens and spaces as non-semantic separators and drops them
(`3-101-123456` → `TRES UNO CERO UNO UNO DOS TRES CUATRO CINCO SEIS`). The raw
value keeps its hyphens up to the transform, and a variable without transform
renders `3-101-123456`. Preserving the separator inside the transform would
change the output of every existing Machote that uses `digits_to_words` on
hyphenated values (plates such as `ABC-102`), so it is intentionally not
changed yet. Minimal proposal pending approval: in `digitsToUppercaseWords`,
keep a hyphen between two digits as a `-` token (e.g.
`TRES - UNO CERO UNO - UNO DOS TRES CUATRO CINCO SEIS`), or scope that rule to
a new opt-in transform, and update the characterization test in
`src/lib/editor/text-transforms.test.ts`.

Candidate fields:

```txt
id
owner_id
full_name
identification_type
identification_number
marital_status
nationality
occupation
exact_address
created_at
updated_at
```

Relationships:

- `owner_id` references `auth.users(id)`.
- Referenced by `receivables`.

Sensitive data:

- Contains personal client metadata and must be treated as sensitive.
- Does not store identity document images, contact details, notes, full legal narratives, or unnecessary transaction details in the first migration.

Ownership rule:

- The owner is the lawyer who created and manages the client record.

RLS need:

- Required. Users can only access their own client records.

Pending questions:

- Decide whether `digits_to_words` should preserve hyphens (see limitation above).
- Decide how to model legal representatives later.

### `templates`

Purpose:

Stores reusable machote definitions owned by a lawyer.

Candidate fields:

```txt
id
owner_id
name
description
category
status
content_json
text_preview
created_at
updated_at
```

Candidate `status` values:

```txt
draft
active
archived
```

These are the initial allowed template status values for the first migration.

Relationships:

- `owner_id` references `auth.users(id)`.
- Has many `template_fields`.
- Has at most one `template_index_configurations` row per owner and template.

Sensitive data:

- Template content may include reusable legal clauses, but must not contain case-specific full escritura text.
- `content_json` must not contain generated document output for a real matter.

Ownership rule:

- The owner is the lawyer who created the template.

RLS need:

- Required. Users can only access their own templates.

Pending questions:

- Define the exact structured template format before implementation.
- Decide whether template versioning is required after MVP.
- Define allowed status transitions.

## Template Variables

Internal variable format:

```txt
{{role.field}}
```

UI display:

- The editor may show user-friendly chips instead of raw braces.
- Example chip: `[Comprador 1: Nombre completo]`.
- The lawyer should not need to manually type braces when using the editor.

Examples:

```txt
{{buyer_1.full_name}}
{{buyer_1.identification_number}}
{{buyer_1.marital_status}}
{{seller_1.full_name}}
{{seller_1.identification_number}}
{{folio_number}}
```

Rules:

- If a variable appears multiple times in a machote, the user fills it once and the value replaces every occurrence.
- Each rendered occurrence has a deterministic `nodeId` used only for focus and inline editing. The shared value remains keyed exclusively by `field_key`; repeated occurrences never create duplicated fields.
- For multiple buyers/sellers in the MVP, use fixed role keys such as `buyer_1`, `buyer_2`, `seller_1`, and `seller_2`.
- Do not implement complex dynamic lists in the MVP.
- Variables must be validated against known `template_fields`.
- Variable names must not execute code or allow arbitrary script behavior.

Pending questions:

- Define exact allowed role keys for first templates.
- Decide when dynamic repeated parties are worth adding after MVP.

### `template_fields`

Purpose:

Stores the input schema for each template, including variables shown to the lawyer during generation.

Candidate fields:

```txt
id
owner_id
template_id
field_key
label
field_type
required
role_key
source
sort_order
created_at
updated_at
```

Candidate `field_type` values:

```txt
text
number
date
time
money
client
select
boolean
textarea
```

Candidate `source` values:

```txt
manual
client
```

Relationships:

- `owner_id` references `auth.users(id)`.
- `template_id` references `templates(id)`.
- `field_key` should be unique per template and role when applicable.
- Fields with the same `role_key` may be completed from the same frequent client record.

Sensitive data:

- Usually low to moderate sensitivity because it stores field definitions, not submitted case values.
- Field definitions must not include real client values or generated document content.

Ownership rule:

- The field owner must match the parent template owner.

RLS need:

- Required. Users can only access fields for their own templates.

Pending questions:

- Decide whether `textarea` should be allowed in first migration or constrained to reduce full escritura capture risk.
- Define validation rules for `field_key` and `role_key`.
- Define exact mappings from client fields to template field sources.

### Template index configuration

`template_index_configurations` stores the reusable owner + template rule for
building the notarial index `Partes` snapshot. It stores only a separator,
optional fixed suffix, explicit-empty choice, and reconciliation state.
`template_index_configuration_fields` stores the selected `template_fields`
and their deterministic order.

The authorization time may alternatively come from a structured Option Block.
The block definition remains in `templates.content_json`, where an optional
`structuredOutput` describes how each variant produces a canonical time from
existing variables. The index configuration stores only the selected stable
block id in `authorized_time_option_block_id`; it is mutually exclusive with
`authorized_time_field_id`.

Initial structured output types:

```txt
none
time
```

For `time`, every variant identifies an hour variable and either a minute
variable or fixed `00` minutes. Resolution uses the selected variant,
`documents.option_selections`, and raw `field_values`. It never parses
`rendered_content` or the legal wording of the variant.

Rules:

- The configuration is unique per `owner_id + template_id`.
- Every selected field must have the same owner and template as its
  configuration.
- Duplicate fields and duplicate positions are rejected.
- An empty selection is valid only when `allow_empty` is explicitly true.
- Removing a selected template field preserves the parent configuration and
  marks it incomplete for explicit reconciliation.
- Saving is transactional through `save_template_index_configuration`, which
  derives the owner from `auth.uid()` and validates all relationships.
- Saving an Option Block time source uses the Workspace-validated transactional
  RPC `save_template_index_mapping_with_block_source`.
- RLS is Workspace- and role-aware on both tables; anonymous access is not allowed.
- The configuration stores no client values or escritura text. Generated
  `Partes` is snapshotted in the document's notarial metadata when saved. For
  new Escrituras, the minimal mapping that produces it is also frozen inside
  `documents.template_snapshot` using stable field keys, so a later Machote
  edit cannot change the historical prefill before metadata is saved.
- Existing variable mappings remain valid. Historical blocks without
  `structuredOutput` continue to render normally but are not offered as an
  index source.

### `documents`

Purpose:

Stores user-owned persistent draft escrituras while the lawyer is preparing a document from a machote.

Decision:

- `documents` is for editable drafts, not generated Word/PDF storage.
- `field_values` stores a flat `field_key -> text` map.
- `rendered_content` stores the server-rendered plain-text result of the last save.
- `template_snapshot` stores one versioned JSON object containing the canonical
  structured document and only its configured field metadata (labels, required
  flags, autofill sources and output transforms). Version 2 additionally stores
  the Machote name and the minimal notarial configuration: simple mappings,
  ordered Partes mappings expressed as stable field keys, separator, optional
  suffix, explicit-empty decision, Option Block time source and reconciliation
  state. It does not duplicate current field values or generated Partes.
  Variables without explicit configuration are derived again from the
  snapshotted document. The snapshot is fixed when the Escritura is created and
  is the shared source for later preview, edits, finalization, DOCX and
  historical notarial preparation.
- `status` supports `draft`, historical `ready`, and `final`. New rows start as
  `draft`; valid drafts may finalize directly, while `ready` remains for
  compatibility with existing rows.
- Editing a machote must not silently rewrite saved draft snapshots.
- Saving a draft again regenerates `rendered_content` from its own `template_snapshot` and saved values, never from the current Machote.
- Rows created before `template_snapshot` remain `null`. They use their historical `rendered_content` as a deterministic plain-text compatibility document; the missing variable/Option Block/formatting structure is not reconstructed from the current Machote.
- Version-1 snapshots preserve their historical document exactly but have no
  historical notarial mapping. They retain the explicit compatibility fallback
  to the current Machote configuration/name; no backfill fabricates historical
  values that were never stored.
- Unknown historical `field_values` should be preserved unless a future explicit deletion workflow is approved.

Candidate fields:

```txt
id
owner_id
template_id
title
status
field_values
rendered_content
template_snapshot nullable
created_at
updated_at
```

Initial allowed `status` values:

```txt
draft
```

Relationships:

- `owner_id` references `auth.users(id)`.
- `(template_id, owner_id)` references `templates(id, owner_id)`.
- The template foreign key must not cascade delete documents; deleting a machote with associated drafts should be blocked.

Sensitive data:

- Contains draft legal text, submitted field values and a structured copy of the Machote content used for that Escritura.
- Must be treated as sensitive user-owned data.
- Must not contain generated Word/PDF files, signed documents, official submission payloads, or storage paths.

Ownership rule:

- The owner is the lawyer who created and manages the draft.
- `owner_id` is always derived from the authenticated user, never from the browser.

RLS need:

- Required. Users can only select, insert, update, and delete their own draft documents.
- Insert/update policies must also verify that the referenced template belongs to the same owner.

Pending questions:

- Whether future non-draft statuses are needed.
- Whether future draft archival or soft delete is needed.

### Legacy `document_metadata` and `notarial_records` (removed)

Historical purpose:

The initial migration created `document_metadata` as optional document-workflow metadata and `notarial_records` as its notarial-index child. Neither table was ever consumed by application code or populated by the supported product workflow.

Final decision:

- `documents` owns the persisted Escritura, including its template/client links, title, editable values and stable template snapshot.
- `document_notarial_metadata` owns the structured 1:1 notarial metadata used by the Índice.
- `receivables.document_id` links a Cobro directly to its Escritura.
- `20260915040113_remove_legacy_notarial_tables.sql` removes both legacy tables only after an explicit empty-table guard succeeds.
- The historical definitions remain in the initial migration; they are not part of the current schema.

### `document_notarial_metadata`

Purpose:

Stores structured metadata required to help prepare a notarial index. This
implemented 1:1 table replaced the unused `notarial_records` scaffolding from
the initial migration.

The application prepares metadata only and does not submit official notarial indexes.

Implemented index fields:

```txt
id
owner_id
document_id
protocol_book
initial_folio
final_folio
instrument_number
authorized_at
act_name_snapshot
act_name_override
generated_parties
parties_override
version
created_at
updated_at
```

Column and derivation decisions:

- `instrument_number` is a positive integer.
- `protocol_book`, `initial_folio`, and `final_folio` remain text so values can
  preserve leading zeroes and folio suffixes.
- `authorized_at` is the single structured timestamp used to derive date,
  time, year, month, and fortnight in `America/Costa_Rica`.
- Effective act name uses `act_name_override` before `act_name_snapshot`.
- Effective parties use `parties_override` before `generated_parties`.
- Snapshot and override values are minimal index-oriented text. They must not
  contain the full escritura.
- `version` supports optimistic concurrency when metadata is reviewed.

Deterministic mapped-value normalization:

- Template mappings read the original source from `documents.field_values`,
  never from `rendered_content`. Output transforms such as `number_to_words`
  continue to affect only the rendered Escritura and its DOCX.
- The `es-CR` normalization layer assigns semantic types to each destination:
  instrument number, protocol book, and folios are interpreted as integers;
  authorization date and time are parsed separately; act name and parties
  remain text.
- Parsed values prefill the existing structured metadata fields. A manual
  correction is persisted through the same metadata row and wins over future
  prefill, while the original value remains available from the user-owned
  document draft for review.
- Ambiguous or unsupported text is never guessed and remains pending manual
  review. No legal content is sent to external services or written to logs.
- The text database types for `protocol_book` and folios remain unchanged for
  historical compatibility. This iteration does not rewrite existing saved
  values or require a migration.

Derived `period_half` values:

```txt
FIRST_HALF
SECOND_HALF
```

Relationships:

- `owner_id` references `auth.users(id)`.
- `document_id` references `documents(id)` and is unique, enforcing one
  metadata row per Escritura.

Sensitive data:

- Contains notarial workflow metadata and can be sensitive.
- Should store only what is needed for index preparation.
- `parties` must remain a minimal index-oriented representation and must not become full escritura text.

Ownership rule:

- The owner is the lawyer/notary responsible for the notarial metadata.

RLS need:

- Required. Users can only access their own notarial records.

Rules:

- Completeness requires tomo, both folios, number, authorization date/time,
  effective act, and effective parties. Incomplete records remain reviewable.
- First half-month period: day 1 through day 15.
- Second half-month period: day 16 through the end of the month.
- Instrument numbers are unique per owner and Costa Rica calendar year. This
  prevents accidental duplicate numbers while allowing the sequence to restart
  in a later year. Legacy non-numeric values must be corrected before the
  migration can convert the column, avoiding silent data loss.
- Finalized Escrituras keep their notarial metadata editable because index
  review and correction happens after document finalization. Ownership and
  immutable document linkage remain enforced by RLS and database triggers.
- The system only prepares metadata. It does not send the official index.

Pending questions:

- Validate the annual instrument-number uniqueness rule against real workflows
  before production rollout.

### `receivables`

Purpose:

Stores basic accounts receivable metadata for legal work.

The MVP does not provide formal accounting, tax calculation, electronic invoicing, or separate payment tracking.

Candidate fields:

```txt
id
owner_id
client_id
document_id nullable
description
amount
currency
status
due_date
paid_at
internal_notes
created_at
updated_at
```

Candidate `status` values:

```txt
pending
partial
paid
cancelled
```

These are the initial allowed receivable status values for the first migration.

Relationships:

- `owner_id` references `auth.users(id)`.
- `client_id` references `clients(id)`.
- `document_id` optionally references `documents(id)`.

Sensitive data:

- Contains financial metadata and may be sensitive.
- Does not store tax filings, electronic invoice payloads, payment credentials, or full accounting ledger entries.

Ownership rule:

- The owner is the lawyer tracking the receivable.

RLS need:

- Required. Users can only access their own receivables.

Decisions:

- No separate partial-payment table in MVP.
- Partial payments are tracked using `status = partial` and `internal_notes`.

Pending questions:

- Confirm supported currencies for MVP.

## Deferred: Notes

The independent notes module is outside the first migration.

It may be evaluated later as a separate table, for example `lawyer_notes`.

Possible future fields:

```txt
id
owner_id
title
content
due_date
status
created_at
updated_at
```

Before implementing notes, the project must review:

- Security risk.
- Validation.
- Sanitization.
- Sensitive text risk.
- Whether notes encourage storing full legal narratives that should stay outside the product.

## Deferred: Audit Events

`audit_events` is deferred and must not be included in the first migration.

Audit events remain a possible future improvement for operational traceability and security review.

Possible future fields:

```txt
id
owner_id
event_type
resource_type
resource_id
metadata_json
created_at
```

Future audit logging must not store:

- Generated document content.
- Full escritura text.
- Secrets.
- Full client identity details.
- Complete transaction details.

## Relationship Draft For MVP Schema

```txt
auth.users
  ├─ lawyer_profiles
  ├─ document_settings
  ├─ clients
  │   └─ receivables
  ├─ templates
  │   ├─ template_fields
  │   └─ documents
  ├─ documents
  │   ├─ document_notarial_metadata
  │   └─ receivables
  └─ receivables
```

All child tables still carry their own `owner_id` so RLS does not rely only on joins.

## Fields Intentionally Excluded

The following are intentionally excluded from the first migration:

- Generated Word document binary data.
- Generated PDF binary data.
- Permanent storage paths for generated legal documents.
- Full generated escritura text outside the approved persistent draft workflow.
- Signed document files.
- Digital signature data.
- Official submission payloads or submission credentials.
- Supabase service role keys or other secrets.
- Scanned identity documents.
- Company client fields.
- Legal representative fields.
- Client email.
- Client phone.
- General client notes.
- Full legal case narratives.
- Full accounting ledger entries.
- Electronic invoice payloads.
- Payment card or bank credential data.
- Partial-payment detail rows.
- Audit event rows.
- Independent notes.
- AI prompt, AI response, or AI legal advice fields.

## RLS Planning

RLS is required for every user-owned table:

- `lawyer_profiles`
- `document_settings`
- `clients`
- `templates`
- `template_fields`
- `template_index_configurations`
- `template_index_configuration_fields`
- `documents`
- `document_notarial_metadata`
- `receivables`

Base policy concept:

```sql
owner_id = auth.uid()
```

Policy planning:

- Select: authenticated users can select only rows where `owner_id = auth.uid()`.
- Insert: authenticated users can insert only rows where `owner_id = auth.uid()`.
- Update: authenticated users can update only rows where `owner_id = auth.uid()`.
- Delete: authenticated users can delete only allowed resources where `owner_id = auth.uid()`.
- Child records must validate ownership consistency with parent records.
- Anonymous users must not access private user-owned data.
- Users must not be able to update `owner_id` to transfer ownership.

RLS tests should include:

- User can access own records.
- User cannot access another user's records.
- User cannot create child records under another user's parent record.
- User cannot update `owner_id` to another user.
- Anonymous users cannot access private user-owned data.

### Workspaces (historical Iteration 4 baseline; superseded by Iterations 5–6)

`supabase/migrations/20260804200000_workspace_foundation.sql` adds
`workspaces` and `workspace_members` (role + active/invited/revoked
status), and a `workspace_id` column on every table above (plus
`notarial_index_exports`, `receivable_activity`, `receivable_payments`,
`document_activity`, `template_index_configurations`,
`template_index_configuration_fields`) — the base policy concept above
becomes `is_workspace_member(workspace_id, [roles])` instead of a raw
`owner_id = auth.uid()` comparison, so a workspace membership can be
suspended independently of Supabase Auth. `document_metadata` and
`notarial_records` did **not** get `workspace_id` because they were unused
scaffolding from the first migration; they were later removed by
`20260915040113_remove_legacy_notarial_tables.sql`.

At that historical checkpoint the application implemented one functional role
(`propietario`), no invitations, and `workspace_id` was a
`generated always as (owner_id) stored` column — a deliberate
simplification possible only because a workspace and its sole owner are
1:1 today. Full rationale, what's simplified vs. the original design, and
the rollback runbook are in `docs/WORKSPACE_MULTIUSER_ARCHITECTURE.md`
§11 — read that before changing any RLS policy or `SECURITY DEFINER`
function touched there.

### Roles, invitations and permissions (added, Iteration 5)

`supabase/migrations/20260804210000_workspace_roles_and_invitations.sql`
drops the Iteration 4 `generated always as` expression on `workspace_id`
(now an independently-writable column, defaulted by a new
`default_workspace_id_from_actor()` BEFORE INSERT trigger on all 14
business tables when the caller doesn't set it explicitly) and widens
write RLS to `administrador`/`asistente` per the permission matrix, while
`documents.finalize`/`notarial_index.generate`/`payments.void`/
`members.manage`/`settings.manage` stay `propietario`/`administrador`
only. All 13 composite FKs that used to pair `(child_id, owner_id)` now
pair `(child_id, workspace_id)`, so a non-owning member can write child
rows under a parent they don't own. Two follow-up migrations add
`get_pending_workspace_invitation()` and `list_workspace_members()` —
both `SECURITY DEFINER`, needed because `is_workspace_member()` requires
`status = 'active'` and PostgREST can't read `auth.users` directly.

New `workspace_activity` table (workspace_id, actor_user_id,
target_user_id, event_type, metadata) is an immutable audit log written
only by the 6 new team-management RPCs (`invite_workspace_member`,
`accept_workspace_invitation`, `change_workspace_member_role`,
`suspend_workspace_member`, `reactivate_workspace_member`,
`remove_workspace_member`) — removing a member does not delete their
activity history. Full design rationale, the role hierarchy rules, and
the "1 workspace per user" invariant are in
`docs/WORKSPACE_MULTIUSER_ARCHITECTURE.md` §12.

`20260917174844_enforce_single_active_workspace_membership.sql` convierte la
regla de producto "un Workspace activo por usuario" en una invariante de base
de datos mediante un índice único parcial en `workspace_members(user_id)` para
`status = 'active'`. La aceptación de una invitación bloquea las membresías del
usuario, conserva como `revoked` la membresía real anterior y activa el destino
en la misma transacción. Solo elimina el Workspace de bootstrap si está vacío;
un propietario con datos o equipo debe transferir la propiedad antes de poder
cambiar de Workspace.

### Actor identity and audit snapshots (added, Iteration 6)

`supabase/migrations/20260805100000_actor_identity_audit_snapshots.sql`
adds `actor_name_snapshot`/`actor_role_snapshot` (`not null`) to
`document_activity`, `receivable_activity`, `workspace_activity`, and
`notarial_index_exports` — the actor's email and Workspace role, fixed at
the moment of the event by a new `resolve_actor_snapshot()`
`SECURITY DEFINER` helper, never recalculated on read. A later role
change or removal from the Workspace does not retroactively alter past
rows (verified by pgTAP, not just by design). `lawyer_profiles` was not
duplicated into a new `notary_profiles` table — it already is the
per-Workspace notary identity (Iteration 5), and the Índice Notarial
already read from it, never from the acting user. New
`list_workspace_activity()` RPC (same `SECURITY DEFINER` pattern as
`list_workspace_members()`) finally surfaces `workspace_activity`, which
Iteration 5 wrote but no `src/` code ever read. Full rationale in
`docs/WORKSPACE_MULTIUSER_ARCHITECTURE.md` §13.

## Indexing Considerations

Potential indexes:

```txt
owner_id
template_id
client_id
status
created_at
generated_at
```

Indexes should be added based on real query needs.

Avoid premature optimization.

## Data Minimization Review

Before approving any table or field, answer:

1. Is this field required for the first migration?
2. Is this field sensitive?
3. Can the product work without it?
4. Is this field needed for index metadata, client reuse, or receivables?
5. Does this field increase legal or privacy responsibility?
6. Does this field require special logging restrictions?
7. Does this field need encryption or should it not be stored at all?

## Migration Rules

Migration files must:

- Be reviewed before running in cloud environments.
- Enable RLS for user-owned tables.
- Add policies before exposing data.
- Avoid destructive changes without backup/review.
- Avoid storing generated Word/PDF files, signed documents, official submission payloads, or generated document storage paths.
- Store draft escritura text only through the approved user-owned `documents` model.
- Avoid broad public access.

Future migrations require an explicit approved database task and must extend
the versioned model described here.

### AI template generation ledger (added)

Migration `20260923120000_ai_template_generation.sql` (design in
`docs/AI_TEMPLATE_GENERATION.md`):

- `ai_template_generations`: one row per user-requested generation
  (technical retries only increment `attempts`). Workspace, actor,
  resulting template (`on delete set null`), status, source type,
  provider, model, schema version, input size, tokens, error code,
  `counts_toward_quota`, `review_summary` (variable keys and closed
  warning codes only) and timings. No document text, prompt or response.
  RLS: select for Workspace members; no writes for `anon`/`authenticated`.
  Partial unique index: one `running` row per user.
- `workspace_ai_settings`: optional per-Workspace override of the daily
  per-user limit. No access for `anon`/`authenticated`; administered via
  SQL/service role.
- `begin_ai_template_generation` / `finish_ai_template_generation`:
  `SECURITY INVOKER`, pinned `search_path`, executable only by
  `service_role`. `begin` re-checks active write membership, locks per
  user, closes stale rows and enforces the Costa Rica calendar-day quota;
  `finish` requires a draft template of the same Workspace and writes the
  `template_ai_generated` event in `workspace_activity`.
- pgTAP: `supabase/tests/ai_template_generation.test.sql`.

### Notarial index export history

`notarial_index_exports` stores only minimal operational metadata for an index
download: owner, `docx` format, selected date bounds, row count, and timestamp.
It never stores the generated Word file, its contents, a storage path, or full
escritura text. CSV is not an active format. The owner is always derived from
`auth.uid()` by the restricted `log_notarial_index_export` RPC.

The export query is Workspace- and permission-scoped, restricted to one selected Costa Rica
fortnight, ordered by instrument number with deterministic tie-breakers, and
limited to 2,000 rows. Exceeding the limit fails explicitly rather than
returning a partial index.

## Generated TypeScript Types

The application versions the Supabase-generated public schema types in
`src/lib/supabase/database.types.ts`. Browser, server, and proxy clients use the
generated `Database` type so schema drift is visible during type checking.

Regenerate the file only from the local stack after all local migrations apply:

```bash
pnpm supabase db reset
pnpm supabase:types
pnpm typecheck
```

Review the generated diff before committing it. A type diff must correspond to
an intentional versioned migration. The project does not currently enforce
type regeneration in CI because that would require booting the complete local
Supabase stack in the standard CI job; this can be reconsidered in a dedicated,
reliable database CI task.

## Seed Data Rules

Seed data must be fake.

Do not use:

- Real lawyer data.
- Real client data.
- Real identification numbers.
- Real escritura content.
- Real notarial index data.

Use clearly fake values only.

## Open Questions

- Future details for company clients.
- Future model for legal representatives.
- Whether and how to implement an independent notes module.
- Whether and how to implement audit events.
- Future improvements for `identification_type`.
- Future improvements for dynamic drafting in machotes.
- Whether dynamic lists for multiple parties are needed after fixed MVP role keys.
- Future values for status fields, identification types, document types, and period fields beyond the initial allowed values.
- Which fields should support soft delete.

## Next Step

Future database tasks should update this document when approved decisions change, then add versioned migrations and RLS tests locally.
