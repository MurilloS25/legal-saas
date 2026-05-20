# Database Design

## Status

This document is a planning document.

Do not create production database tables until the schema is reviewed and approved.

The database will use Supabase Postgres.

Supabase Row Level Security is mandatory for user-owned data.

## Database Goals

The database must support:

- Multiple independent lawyers.
- Lawyer profile and document settings.
- Reusable client metadata.
- Template management.
- Template field definitions.
- Minimal document metadata.
- Minimal notarial index metadata.
- Basic accounts receivable.
- Optional audit events without sensitive legal content.

The database must avoid storing:

- Generated legal documents.
- Signed documents.
- Full sensitive escritura content.
- Unnecessary legal transaction details.
- Secrets or credentials.

## Ownership Model

Most user-owned tables should include:

```sql
owner_id uuid not null references auth.users(id)
```

Base RLS idea:

```sql
owner_id = auth.uid()
```

The exact policies will be defined in migration files after schema approval.

## Initial Entity List

Potential MVP entities:

- `lawyer_profiles`
- `document_settings`
- `clients`
- `templates`
- `template_fields`
- `document_metadata`
- `notarial_records`
- `receivables`
- `audit_events`

These names may change during schema design.

## Proposed Tables

### `lawyer_profiles`

Purpose:

Stores basic profile data for the authenticated lawyer.

Potential fields:

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

Notes:

- `owner_id` should reference `auth.users(id)`.
- Do not store unnecessary personal data.
- Professional code requirements must be validated later.

### `document_settings`

Purpose:

Stores default formatting preferences for generated documents.

Potential fields:

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

Notes:

- One user may have one active default settings record.
- Later versions may support multiple formatting presets.

### `clients`

Purpose:

Stores reusable client metadata.

Potential fields:

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

Potential `client_type` values:

```txt
individual
company
```

Notes:

- Keep fields minimal.
- Avoid adding sensitive details unless needed.
- Legal representative data may be added later if required.

### `templates`

Purpose:

Stores reusable machote definitions.

Potential fields:

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

Potential `status` values:

```txt
draft
active
archived
```

Notes:

- `content_json` should store structured template content.
- Avoid storing templates only as raw HTML.
- `text_preview` may support search/display.
- Template versioning is deferred.

### `template_fields`

Purpose:

Stores the field schema for a template.

Potential fields:

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

Potential `field_type` values:

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

Notes:

- `field_key` must be unique per template.
- Field keys should be validated.
- Options should be used for select fields.
- Client fields may map to reusable client metadata.

### `document_metadata`

Purpose:

Stores minimal metadata about a generated document event or matter.

This table must not store the generated document itself.

Potential fields:

```txt
id
owner_id
template_id
title
document_type
status
generated_at
created_at
updated_at
```

Potential `status` values:

```txt
draft
generated
finalized
archived
```

Notes:

- This is metadata only.
- Do not store final Word document files.
- Do not store full generated escritura text.
- Decide later whether every download creates a metadata record automatically.

### `notarial_records`

Purpose:

Stores minimal structured metadata needed to help prepare a notarial index.

Potential fields:

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

Notes:

- Exact fields must be validated with a real anonymized index example.
- Do not add unnecessary transaction details.
- The application prepares metadata only.
- The application does not submit the official index.

### `receivables`

Purpose:

Stores basic accounts receivable data related to legal work.

Potential fields:

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

Potential `status` values:

```txt
pending
partial
paid
cancelled
```

Notes:

- MVP does not include formal accounting.
- MVP does not include electronic invoicing.
- Receivables should remain simple.

### `audit_events`

Purpose:

Stores non-sensitive audit events.

Potential fields:

```txt
id
owner_id
event_type
resource_type
resource_id
metadata_json
created_at
```

Potential event types:

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

Notes:

- Do not store generated document content.
- Do not store full escritura content.
- Do not store secrets.
- Keep metadata minimal.

## Relationship Draft

```txt
auth.users
  └─ lawyer_profiles
  └─ document_settings
  └─ clients
  └─ templates
       └─ template_fields
  └─ document_metadata
       └─ notarial_records
       └─ receivables
  └─ audit_events
```

Possible additional relationships:

```txt
clients
  └─ receivables

templates
  └─ document_metadata
```

## RLS Requirements

Every user-owned table must enable RLS.

Required policy types:

- Select own rows.
- Insert own rows.
- Update own rows.
- Delete own rows when allowed.

Base idea:

```sql
create policy "Users can select own rows"
on table_name
for select
using (owner_id = auth.uid());
```

This is only an example. Final policies must be written per table.

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

## Next Step

The next database task should produce:

1. Final MVP entity list.
2. Final field list.
3. Relationship diagram.
4. RLS policy plan.
5. First Supabase migration plan.

Do not create migrations until this design is approved.
