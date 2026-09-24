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
- An AI legal assistant. The single AI feature ("Crear con IA") only proposes
  the structure of a new draft Machote from one document; see
  `docs/AI_TEMPLATE_GENERATION.md`.

## Included In MVP

### AI-Assisted Machote Generation (bounded)

- "Crear con IA" creates a new **draft** Machote from one pasted text, one
  `.docx` or one text-layer PDF, reusing the existing Machote model
  (variables, Option Blocks, normalizations, Notarial Index mapping).
- The AI never publishes, never edits existing Machotes, has no tools and
  no chat. Human review and publication are mandatory.
- The source document is processed in memory and never persisted.
- Details, limits and security model: `docs/AI_TEMPLATE_GENERATION.md`.

### Authentication And User Profile

- Private-pilot login, invitation acceptance and password recovery through
  Supabase Auth; public signup is disabled.
- One notarial Workspace per account membership, with current roles
  `propietario`, `administrador`, `asistente` and `solo_lectura`.
- Personal account identity, shared professional/notarial profile, team
  management and default document formatting preferences.

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

Any Machote can be duplicated ("Duplicar machote", `templates.write`) into a
new independent **draft** named "X - Copia" / "X - Copia 2"…: same document,
variables (autofill and transforms), Option Blocks and Índice configuration,
with new internal ids. Activity, AI generation metadata, timestamps and the
Escrituras created from the original are never copied.

### Document Generation

The MVP lets authorized Workspace members save escrituras while they work,
using validated field values, Option Block selections, a server-rendered text
snapshot and an immutable structured snapshot of the source Machote.

Word (`.docx`) export is implemented: the lawyer downloads the saved draft as an editable Word file generated on demand in server memory and discarded immediately — never stored. See `docs/DOCX_EXPORT.md`.

The application may store `field_values`, `option_selections`,
`rendered_content` and the minimal `template_snapshot` required to keep an
Escritura editable and exportable against the Machote version used at creation.

An escritura may optionally be associated with a single principal client (`documents.client_id`, nullable); the association is never required and the escritura survives if the client is later deleted (`client_id` becomes NULL).

Escrituras use `draft` (Borrador) and `final` (Finalizada). A valid draft may
be finalized directly; finalization is blocked by unsaved changes, pending
required active variables or a concurrent update. A finalized Escritura is
read-only until an authorized user reopens it. Historical `ready` rows remain
supported and may be finalized or returned to draft. `final` does not mean
signed, submitted or officially filed.

The workspace uses Completar → Cobro → Índice. Preview lives in Completar;
`Revisar y finalizar` is not a separate step. Guardar is a single persistent
action without auto-advance. Finalizar and Reabrir are lifecycle actions;
Descargar Word, Historial and Duplicar remain available as document utilities.
Dirty-state and navigation guards preserve local edits, and saves/finalization
use optimistic concurrency.

The `/documents` workspace supports server-side search (title, client, template), filters (status, client, template), sort, and pagination, all reflected in shareable query params.

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

Each Escritura snapshots the Machote's default inclusion decision at creation.
After finalization, authorized users may include or exclude it from the Index.
Notarial metadata progresses through pending, ready-to-confirm, confirmed and
correction-required states. Confirmation binds to the exact persisted visible
snapshot; reopening invalidates confirmation without deleting metadata.
The Índice section shows one primary action per state and says what is
missing: Guardar while there are unsaved changes, missing data or a content
change to review; Confirmar only when everything is complete and saved;
Corregir once confirmed. Guardar never confirms and Confirmar never saves.
`Partes` distinguishes derived, manually overridden and explicitly empty data.

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

- Workspace membership and role isolation.
- Supabase RLS for Workspace-owned data.
- Input validation.
- Data minimization.
- No storage of generated Word/PDF files.
- Persistent Escritura content is sensitive Workspace data and must stay protected by validation, RLS, and safe logging rules.
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
- AI product features other than the bounded "Crear con IA" draft generation
  (no AI chat, legal advice, RAG, OCR, multi-document analysis or AI editing
  of existing Machotes).
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
- Custom permissions beyond the current fixed role matrix.
- Multiple Workspaces per account and enterprise multi-firm hierarchy.
- Audit log dashboard.
- Electronic invoicing integration.
- Advanced reports.
- Official platform integrations, only if legally and technically appropriate.
- AI improvements to existing Machotes (analysis, correction, chat), only after the v1 generation is reviewed in real use.

## Data Boundaries

The application may store:

- User profile data.
- Template definitions.
- Template field definitions.
- Persistent `field_values` and Option Block selections.
- Persistent `rendered_content` text snapshots.
- Minimal versioned `template_snapshot` objects for new Escrituras.
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
