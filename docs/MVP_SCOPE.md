# MVP Scope

## Product Goal

Build a legal productivity SaaS MVP for independent lawyers in Costa Rica.

The product helps lawyers create and manage reusable legal document templates called "machotes", prepare persistent draft escrituras, generate editable Word documents, reuse client metadata, prepare notarial index metadata, and track basic accounts receivable.

The system supports the lawyer's workflow, but it does not replace the lawyer's legal judgment, official responsibilities, digital signature process, document custody, or official submissions.

## Primary User

The primary user is an independent lawyer or notary in Costa Rica who needs to generate recurring legal documents faster and with fewer manual errors.

The MVP must support multiple independent lawyers from the beginning.

The MVP is not designed as a complex multi-firm enterprise system yet.

## Product Positioning

This application is:

- A productivity tool.
- A template management tool.
- A document generation assistant.
- A structured metadata capture tool.
- A basic accounts receivable tracker.

This application is not:

- A legal authority.
- A law firm ERP.
- A digital signature platform.
- An official notarial index submission system.
- A long-term custody system for generated legal documents.
- A legal advice system.
- An AI legal assistant.

## Included In MVP

### Authentication And User Profile

- User registration and login through Supabase Auth.
- Basic lawyer profile.
- Default document formatting preferences.

### Document Formatting Settings

Each user may configure default document preferences such as:

- Font family.
- Font size.
- Page margins.
- Line spacing.
- Default date format.
- Lawyer or notary profile data used in templates.

### Client Metadata Reuse

The MVP includes a client catalog for recurring legal work.

Initial client types:

- Individual person.
- Legal entity or company.

The client module should store only reusable metadata needed for document generation and index preparation.

### Template Management

The MVP includes a template catalog and template editing workflow for reusable machotes.

The first version should prioritize a controlled editor with variables and basic formatting, not a full Microsoft Word clone.

Templates may include:

- Static text.
- Basic formatting.
- Variables.
- Required fields.
- Optional fields.
- Simple conditional blocks.
- Repeated parties or roles when needed.

### Document Generation

The MVP lets lawyers save draft escrituras while they work, using validated field values and a server-rendered text snapshot.

Word (`.docx`) export is implemented: the lawyer downloads the saved draft as an editable Word file generated on demand in server memory and discarded immediately — never stored. See `docs/DOCX_EXPORT.md`.

The application may store draft `field_values` and `rendered_content` for the user's own persistent drafts.

An escritura may optionally be associated with a single principal client (`documents.client_id`, nullable); the association is never required and the escritura survives if the client is later deleted (`client_id` becomes NULL).

Escrituras have a basic lifecycle: `draft` (Borrador) → `ready` (Listo para revisar) → `final` (Finalizado). Transitions are `draft↔ready` and `ready↔final`; a draft cannot jump straight to final. Finalizing is blocked while variables are pending. A finalized escritura is read-only until reopened. `final` does not mean signed, submitted, or officially filed — no signature or submission is implied.

The `/dashboard/documents` workspace supports server-side search (title, client, template), filters (status, client, template), sort, and pagination, all reflected in shareable query params.

Each escritura has a read-only activity history (`document_activity`) shown in its detail: creation, title/client/status changes, finalization/reopening, and Word generation. Events are written server-side only — document mutations record them atomically via a trigger, Word generation via a `SECURITY DEFINER` RPC — never from arbitrary client input, and never surface UUIDs or raw content. Events are immutable (no update/delete) and cascade-deleted with their escritura. It is designed as reusable infrastructure for future modules (notarial index, receivables, notes, versioning).

The application must not store generated Word/PDF files, signed documents, official submission payloads, or storage paths for generated legal documents.

PDF generation is not mandatory for the MVP. It may be added later after Word generation is stable.

### Notarial Index Metadata Preparation

The MVP stores minimal structured metadata needed to help prepare a notarial index.

The system may help:

- Capture relevant metadata.
- Filter by period.
- Validate missing required fields.
- Export a table or Word document with prepared metadata.

The implemented workflow selects a calendar year, month, and Costa Rica
fortnight (days 1–15 or 16–month end), keeps a fixed instrument-number order,
warns about incomplete rows without blocking the lawyer, and downloads an
editable `.docx`. The file is generated in server memory and discarded after
the response. CSV export is not supported.

The system must not submit the official notarial index.

The lawyer remains responsible for official submission and validation.

### Accounts Receivable

The MVP includes basic accounts receivable tracking related to matters or generated document metadata.

Initial fields may include:

- Related client.
- Related document metadata.
- Amount.
- Payment status.
- Payment date.
- Notes.
- Basic monthly summary.

The MVP does not include formal accounting or electronic invoicing.

### Security And Data Minimization

The MVP must include:

- User-owned data isolation.
- Supabase RLS for user-owned data.
- Input validation.
- Data minimization.
- No storage of generated Word/PDF files.
- Persistent draft escritura text is sensitive user-owned data and must stay protected by validation, RLS, and safe logging rules.
- No storage of unnecessary sensitive legal details outside the draft workflow.

### Accessibility

The MVP must consider accessibility from the start, especially for form-heavy workflows.

Required principles:

- Semantic HTML.
- Labels for inputs.
- Keyboard navigation.
- Visible focus states.
- Clear error messages.
- Logical tab order.
- Accessible dialogs and menus.

## Excluded From MVP

The following features are intentionally excluded:

- Storing generated Word/PDF files.
- Storing signed documents.
- Storing official submission payloads.
- Storing generated document storage paths.
- Storing full sensitive escritura content outside the approved persistent draft workflow.
- Digital signatures.
- Official legal submissions.
- Official notarial index submission.
- Legal advice or legal decision-making.
- AI product features.
- Complex multi-firm account hierarchy.
- Full accounting.
- Electronic invoicing.
- Full Word-compatible editor inside the browser.
- Uploading and parsing existing `.docx` templates as a mandatory MVP feature.
- Self-hosted production Docker deployment.

## Deferred Features

These may be considered after the MVP:

- PDF export.
- Uploading existing `.docx` templates.
- More advanced template versioning.
- More advanced role management.
- Multi-lawyer firm accounts.
- Audit log dashboard.
- Electronic invoicing integration.
- Advanced reports.
- Official platform integrations, only if legally and technically appropriate.
- AI-assisted template suggestions, only after the core product is stable and legal risks are reviewed.

## Data Boundaries

The application may store:

- User profile data.
- Template definitions.
- Template field definitions.
- Persistent draft `field_values`.
- Persistent draft `rendered_content` text snapshots.
- Client metadata.
- Minimal document metadata.
- Minimal notarial index metadata.
- Accounts receivable metadata.
- Operational audit events without sensitive legal content.

The application must not store:

- Final generated Word documents.
- Generated PDF files.
- Signed documents.
- Official submission payloads.
- Storage paths for generated legal documents.
- Full escritura text outside the approved persistent draft workflow.
- Complete sensitive details that are not required by the workflow.
- Secrets or credentials in application data.

## Success Criteria

The MVP is successful if an independent lawyer can:

1. Create or configure a profile.
2. Register frequent clients.
3. Create a reusable machote with variables.
4. Generate an editable Word document from that machote.
5. Download the generated Word file.
6. Register minimal metadata for index preparation.
7. Track whether the related work has been paid.
8. Use the system without generated Word/PDF files or signed legal documents being stored by the application.

## First Implementation Priorities

Recommended implementation order:

1. Project documentation and architecture.
2. Database model design.
3. Supabase migrations and RLS policies.
4. Authentication and protected dashboard shell.
5. Lawyer profile and document settings.
6. Clients module.
7. Templates module.
8. Document generation module.
9. Notarial index metadata module.
10. Accounts receivable module.

## Open Questions

- What exact fields are required for the notarial index metadata?
- What exact default margins and formatting should be provided for Costa Rica legal documents?
- Which client fields should be mandatory in the first version?
- Should generated document metadata be created automatically every time a document is downloaded?
- Which events require audit logging in the MVP?
