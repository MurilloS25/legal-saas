# Database Design

## Status

This is the planning document for the initial MVP database model.

Do not create tables, migrations, seed files, or Supabase Cloud resources from this document until the first migration task is explicitly approved.

The database target is Supabase Postgres with Supabase Auth and Row Level Security.

## MVP Database Decisions

- Supabase Auth is the source of truth for application users.
- Every user-owned application table in the first migration includes `owner_id uuid not null references auth.users(id)`.
- RLS is required for every user-owned table before the table is used by product code.
- Users can only access their own records.
- Child records must validate ownership consistency with parent records.
- Anonymous users must not access private user-owned data.
- Generated legal documents are never stored in the database or application storage.
- Generated Word files, PDFs, full escritura text, and storage paths for generated documents are intentionally excluded.
- The first migration focuses on independent lawyers and physical-person clients.
- Company clients, legal representatives, audit events, and independent notes are deferred.
- The database stores only structured metadata required for lawyer profile settings, clients, templates, optional document metadata, notarial index preparation, and basic receivables.
- `document_metadata` is not created automatically every time a Word document is generated.
- `document_metadata` is created only when the user chooses to save information for notarial index preparation and/or accounts receivable.
- Accounts receivable is intentionally basic and does not include formal accounting, tax calculation, electronic invoicing, or a separate partial-payment table.
- This document describes candidate fields only. Migrations are intentionally deferred.

## Database Goals

The MVP database must support:

- Multiple independent lawyers.
- Lawyer profile data.
- One default document formatting configuration per lawyer.
- Physical-person client metadata.
- Template management.
- Template variable and field definitions.
- Optional document metadata for index and/or receivable workflows.
- Structured notarial index metadata preparation.
- Basic accounts receivable.

The database must avoid storing:

- Generated `.docx` or PDF files.
- Storage paths for generated legal documents.
- Signed documents.
- Full escritura text.
- Official submission payloads.
- Secrets or credentials.
- Unnecessary legal transaction detail.
- AI prompts, AI responses, or AI legal advice content.

## First Migration Scope

Candidate tables for the first migration:

- `lawyer_profiles`
- `document_settings`
- `clients`
- `templates`
- `template_fields`
- `document_metadata`
- `notarial_records`
- `receivables`

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

Stores the lawyer's default formatting preferences for generated Word documents.

Decision:

- One default configuration per lawyer.
- No named presets in the MVP.

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

Stores reusable client metadata for physical persons.

Decision:

- First migration focuses on physical-person clients only.
- `identification_type` remains included for future compatibility.
- MVP will primarily use `cedula_fisica`.
- Initial allowed `identification_type` value: `cedula_fisica`.
- Company clients are deferred.
- Legal representative data is deferred.
- `email` and `phone` are not first-migration fields.
- `notes` is not a first-migration field.

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
- May be referenced by `document_metadata`.
- Referenced by `receivables`.

Sensitive data:

- Contains personal client metadata and must be treated as sensitive.
- Does not store identity document images, contact details, notes, full legal narratives, or unnecessary transaction details in the first migration.

Ownership rule:

- The owner is the lawyer who created and manages the client record.

RLS need:

- Required. Users can only access their own client records.

Pending questions:

- Decide how to model company clients later.
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
- May be referenced by `document_metadata`.

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

### `document_metadata`

Purpose:

Stores minimal metadata about a document workflow only when the user chooses to save information for index preparation and/or receivables.

Decision:

- Do not create `document_metadata` automatically every time a Word document is generated.
- Create metadata only when the user decides to save information for index and/or billing.

Candidate fields:

```txt
id
owner_id
template_id
client_id nullable
title
document_type
created_for_index
created_for_receivable
generated_at
created_at
updated_at
```

Initial allowed `document_type` values:

```txt
escritura
nota
otro
```

Relationships:

- `owner_id` references `auth.users(id)`.
- `template_id` references `templates(id)`.
- `client_id` optionally references `clients(id)`.
- May have one `notarial_records` row.
- May be referenced by `receivables`.

Sensitive data:

- Contains legal workflow metadata and should be treated as sensitive.
- Does not store generated Word files.
- Does not store PDFs.
- Does not store full escritura text.
- Does not store a storage path for a generated document.

Ownership rule:

- The owner is the lawyer who manages the document metadata.

RLS need:

- Required. Users can only access their own document metadata.

Pending questions:

- Decide whether additional document types are needed after initial template workflows are tested.

### `notarial_records`

Purpose:

Stores structured metadata required to help prepare a notarial index.

The application prepares metadata only and does not submit official notarial indexes.

Candidate fields:

```txt
id
owner_id
document_metadata_id
volume
initial_folio
final_folio
deed_number
deed_date
deed_time
act_or_contract
parties
period_half
period_month
period_year
created_at
updated_at
```

Column type decision:

- `parties` is `text` for the MVP.

Initial allowed `period_half` values:

```txt
first
second
```

Relationships:

- `owner_id` references `auth.users(id)`.
- `document_metadata_id` references `document_metadata(id)`.

Sensitive data:

- Contains notarial workflow metadata and can be sensitive.
- Should store only what is needed for index preparation.
- `parties` must remain a minimal index-oriented representation and must not become full escritura text.

Ownership rule:

- The owner is the lawyer/notary responsible for the notarial metadata.

RLS need:

- Required. Users can only access their own notarial records.

Rules:

- All listed notarial record fields are required for the index.
- First half-month period: day 1 through day 15.
- Second half-month period: day 16 through the end of the month.
- The system only prepares metadata. It does not send the official index.

Pending questions:

- Decide whether `parties` should become structured JSON after MVP validation.

### `receivables`

Purpose:

Stores basic accounts receivable metadata for legal work.

The MVP does not provide formal accounting, tax calculation, electronic invoicing, or separate payment tracking.

Candidate fields:

```txt
id
owner_id
client_id
document_metadata_id nullable
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
- `document_metadata_id` optionally references `document_metadata(id)`.

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
- Decide if `document_metadata_id` becomes required after workflows are tested.

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

## Relationship Draft For First Migration

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
  └─ receivables
```

All child tables still carry their own `owner_id` so RLS does not rely only on joins.

## Fields Intentionally Excluded

The following are intentionally excluded from the first migration:

- Generated Word document binary data.
- Generated PDF binary data.
- Permanent storage paths for generated legal documents.
- Full generated escritura text.
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

RLS is required for every first-migration user-owned table:

- `lawyer_profiles`
- `document_settings`
- `clients`
- `templates`
- `template_fields`
- `document_metadata`
- `notarial_records`
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
period_month
period_year
period_half
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

The next database task should produce the first Supabase migration plan based on the approved first migration scope.

Do not create migrations until this design is approved.
