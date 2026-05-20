# Database Design

## Status

This is a planning document for the initial MVP database model.

Do not create tables, migrations, seed files, or Supabase Cloud resources from this document until the schema is reviewed and explicitly approved.

The database target is Supabase Postgres with Supabase Auth and Row Level Security.

## MVP Database Decisions

- Supabase Auth is the source of truth for application users.
- Every user-owned application table includes `owner_id uuid not null references auth.users(id)`.
- RLS is required for every user-owned table before the table is used by product code.
- Generated legal documents are never stored in the database or application storage.
- Full sensitive escritura content is never stored.
- The database stores reusable structured metadata, template definitions, generation metadata, index preparation metadata, receivables metadata, and safe audit events.
- Template content should be structured enough to validate variables and fields; raw HTML-only template storage is not the preferred model.
- `document_metadata` records the fact and business context of a document workflow, not the generated file or full generated text.
- Notarial index features prepare metadata only. The application does not submit official notarial indexes.
- Accounts receivable is intentionally basic and not a formal accounting or electronic invoicing system.
- This document describes candidate fields only. Migrations are intentionally deferred.

## Database Goals

The MVP database must support:

- Multiple independent lawyers.
- Lawyer profile and document formatting settings.
- Reusable client metadata.
- Template management and template fields.
- Minimal generated document metadata.
- Minimal notarial index metadata preparation.
- Basic accounts receivable.
- Non-sensitive audit events.

The database must avoid storing:

- Generated `.docx` or PDF files.
- Signed documents.
- Full escritura text.
- Official submission payloads.
- Secrets or credentials.
- Unnecessary legal transaction detail.

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

- Contains personal/professional contact data.
- Does not store official credentials, signatures, identity scans, or authentication secrets.

Ownership rule:

- The owner is the authenticated user identified by `owner_id`.

RLS need:

- Required. Users can only select, insert, update, and delete their own profile.

Pending questions:

- Confirm the exact professional code field required for Costa Rica lawyers/notaries.
- Decide whether profile email should duplicate Supabase Auth email or be an editable contact email.

### `document_settings`

Purpose:

Stores each lawyer's default formatting preferences for generated Word documents.

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
line_spacing
default_date_format
created_at
updated_at
```

Relationships:

- `owner_id` references `auth.users(id)`.
- Usually one active settings record per owner.

Sensitive data:

- Low sensitivity. Mostly formatting preferences.

Ownership rule:

- The owner is the authenticated user identified by `owner_id`.

RLS need:

- Required. Users can only manage their own document settings.

Pending questions:

- Decide whether MVP supports one default settings record or named presets.
- Confirm default legal document formatting values with target users.

### `clients`

Purpose:

Stores reusable client metadata for document generation, notarial index preparation, and receivables.

Candidate fields:

```txt
id
owner_id
client_type
display_name
identification_type
identification_number
email
phone
address
notes
created_at
updated_at
```

Candidate `client_type` values:

```txt
individual
company
```

Relationships:

- `owner_id` references `auth.users(id)`.
- May be referenced by `document_metadata`.
- May be referenced by `receivables`.

Sensitive data:

- Contains client personal or company metadata and should be treated as sensitive.
- Does not store identity document images, full legal narratives, or unnecessary transaction details.

Ownership rule:

- The owner is the lawyer who created and manages the client record.

RLS need:

- Required. Users can only access their own client records.

Pending questions:

- Confirm required MVP fields for individuals versus companies.
- Decide whether legal representative metadata is required in MVP or should be deferred.
- Decide whether `notes` should be limited or replaced with structured fields to reduce sensitive free text.

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

Relationships:

- `owner_id` references `auth.users(id)`.
- Has many `template_fields`.
- May be referenced by `document_metadata`.

Sensitive data:

- Template text can be sensitive if it contains legal clauses, but it should be reusable template content, not case-specific escritura content.
- `content_json` must not contain generated document output for a real matter.

Ownership rule:

- The owner is the lawyer who created the template.

RLS need:

- Required. Users can only access their own templates.

Pending questions:

- Define the exact structured template format.
- Decide whether template versioning is required in MVP or deferred.
- Define allowed status transitions.

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
default_value
options_json
help_text
sort_order
created_at
updated_at
```

Candidate `field_type` values:

```txt
text
number
date
money
client
select
boolean
textarea
```

Relationships:

- `owner_id` references `auth.users(id)`.
- `template_id` references `templates(id)`.
- `field_key` should be unique per template.

Sensitive data:

- Usually low to moderate sensitivity because it stores field definitions, not submitted case values.
- `default_value` and `help_text` should not contain sensitive real client data.

Ownership rule:

- The field owner must match the parent template owner.

RLS need:

- Required. Users can only access fields for their own templates.

Pending questions:

- Decide whether `textarea` is allowed in MVP or should be constrained to prevent full escritura capture.
- Define validation rules for `field_key`.
- Define how client fields map to reusable client metadata.

### `document_metadata`

Purpose:

Stores minimal metadata about a document workflow or generation event.

This table must not store generated files or full generated text.

Candidate fields:

```txt
id
owner_id
template_id
client_id
title
document_type
status
generated_at
created_at
updated_at
```

Candidate `status` values:

```txt
draft
generated
finalized
archived
```

Relationships:

- `owner_id` references `auth.users(id)`.
- `template_id` references `templates(id)`.
- `client_id` optionally references `clients(id)`.
- May have one `notarial_records` row.
- May have one or more `receivables` rows if billing is split later.

Sensitive data:

- Contains legal workflow metadata and should be treated as sensitive.
- Does not store generated `.docx`, PDF, storage path, or full escritura text.

Ownership rule:

- The owner is the lawyer who generated or manages the document metadata.

RLS need:

- Required. Users can only access their own document metadata.

Pending questions:

- Decide whether metadata is created before generation, after download, or both.
- Decide whether `client_id` is required or optional for all document types.
- Define which document types are allowed in MVP.

### `notarial_records`

Purpose:

Stores minimal structured metadata to help prepare a notarial index.

The application prepares metadata only and does not submit official notarial indexes.

Candidate fields:

```txt
id
owner_id
document_metadata_id
instrument_number
book_number
folio
grant_date
act_type
parties_summary
amount
include_in_index
index_period_start
index_period_end
notes
created_at
updated_at
```

Relationships:

- `owner_id` references `auth.users(id)`.
- `document_metadata_id` references `document_metadata(id)`.

Sensitive data:

- Contains notarial workflow metadata and can be sensitive.
- Should store only what is needed for index preparation.
- `parties_summary` and `notes` should remain minimal and must not become full escritura text.

Ownership rule:

- The owner is the lawyer/notary responsible for the notarial metadata.

RLS need:

- Required. Users can only access their own notarial records.

Pending questions:

- Validate exact Costa Rica notarial index fields with a real anonymized example.
- Decide whether `parties_summary` should be replaced with structured party references.
- Decide whether `notes` should exist in MVP or be removed to reduce free-text risk.

### `receivables`

Purpose:

Stores basic accounts receivable metadata for legal work.

The MVP does not provide formal accounting, tax calculation, or electronic invoicing.

Candidate fields:

```txt
id
owner_id
client_id
document_metadata_id
description
amount
currency
status
due_date
paid_at
notes
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

Relationships:

- `owner_id` references `auth.users(id)`.
- `client_id` references `clients(id)`.
- `document_metadata_id` optionally references `document_metadata(id)`.

Sensitive data:

- Contains financial metadata and may be sensitive.
- Does not store tax filings, electronic invoice payloads, payment credentials, or full accounting ledger entries.

Ownership rule:

- The owner is the lawyer tracking the receivable.

RLS need:

- Required. Users can only access their own receivables.

Pending questions:

- Decide if `document_metadata_id` is required or optional.
- Decide whether partial payments need separate payment rows after MVP.
- Confirm supported currencies for MVP.

### `audit_events`

Purpose:

Stores safe operational audit events without sensitive legal content.

Candidate fields:

```txt
id
owner_id
event_type
resource_type
resource_id
metadata_json
created_at
```

Candidate `event_type` values:

```txt
profile.updated
client.created
client.updated
template.created
template.updated
document.generated
index.exported
receivable.status_changed
```

Relationships:

- `owner_id` references `auth.users(id)`.
- `resource_id` may reference different resource tables by convention, not necessarily by foreign key.

Sensitive data:

- Must be non-sensitive.
- Must not store generated document content, full escritura text, secrets, full client identity details, or complete transaction details.

Ownership rule:

- The owner is the user whose account/workspace the event belongs to.

RLS need:

- Required. Users can only read audit events for their own account.
- Insert rules may be server-mediated later to reduce tampering.

Pending questions:

- Decide which MVP events are mandatory.
- Decide whether users can view audit events in the MVP UI.
- Decide whether `metadata_json` should be replaced by stricter typed columns for specific events.

## Relationship Draft

```txt
auth.users
  ├─ lawyer_profiles
  ├─ document_settings
  ├─ clients
  │   ├─ document_metadata
  │   └─ receivables
  ├─ templates
  │   ├─ template_fields
  │   └─ document_metadata
  ├─ document_metadata
  │   ├─ notarial_records
  │   └─ receivables
  └─ audit_events
```

All child tables still carry their own `owner_id` so RLS does not rely only on joins.

## Fields Intentionally Excluded

The following are intentionally excluded from the MVP schema:

- Generated Word document binary data.
- Generated PDF binary data.
- Permanent storage paths for generated legal documents.
- Full generated escritura text.
- Signed document files.
- Digital signature data.
- Official submission payloads or submission credentials.
- Supabase service role keys or other secrets.
- Scanned identity documents.
- Full legal case narratives.
- Full accounting ledger entries.
- Electronic invoice payloads.
- Payment card or bank credential data.
- AI prompt, AI response, or AI legal advice fields.

## RLS Planning

RLS is required for every proposed user-owned table:

- `lawyer_profiles`
- `document_settings`
- `clients`
- `templates`
- `template_fields`
- `document_metadata`
- `notarial_records`
- `receivables`
- `audit_events`

Base policy concept:

```sql
owner_id = auth.uid()
```

Policy planning:

- Select: authenticated users can select only rows where `owner_id = auth.uid()`.
- Insert: authenticated users can insert only rows where `owner_id = auth.uid()`.
- Update: authenticated users can update only rows where `owner_id = auth.uid()`.
- Delete: authenticated users can delete only allowed resources where `owner_id = auth.uid()`.
- Child records should validate ownership consistency with parent records.
- Audit event insertion may be restricted to server-side flows in a later implementation plan.

RLS tests should include:

- User can access own records.
- User cannot access another user's records.
- User cannot create child records under another user's parent record.
- User cannot update `owner_id` to transfer ownership.
- Anonymous users cannot access private user-owned data.

## Indexing Considerations

Potential indexes:

```txt
owner_id
template_id
client_id
document_metadata_id
status
created_at
generated_at
include_in_index
index_period_start
index_period_end
```

Indexes should be added based on real query needs.

Avoid premature optimization.

## Data Minimization Review

Before approving any table or field, answer:

1. Is this field required for the MVP?
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
- Avoid storing generated documents.
- Avoid broad public access.

No migrations should be created until this design is approved.

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

- What exact fields are required in the Costa Rica notarial index?
- Should `document_settings` be one-to-one with profile or support presets?
- Should legal representative data be part of `clients` in MVP?
- Should `document_metadata` be created before or after generation?
- Should receivables be linked to clients, document metadata, or both?
- Which audit events are mandatory for MVP?
- Which fields should support soft delete?
- Which free-text fields should be removed or constrained before migration design?

## Next Step

The next database task should produce:

1. Final MVP entity list.
2. Final field list.
3. Relationship diagram.
4. RLS policy plan.
5. First Supabase migration plan.

Do not create migrations until this design is approved.
