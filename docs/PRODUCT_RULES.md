# Product Rules

## Product Identity

This product is a legal productivity SaaS for independent lawyers in Costa Rica.

It helps lawyers work faster with reusable templates, client metadata, generated editable Word documents, notarial index metadata preparation, and basic accounts receivable.

It is not a legal authority or an official legal submission platform.

## Core Product Rule

The app supports the lawyer.

The lawyer remains responsible for legal review, legal judgment, signing, filing, official submissions, document custody, and compliance with professional obligations.

## MVP Boundaries

The MVP must not include:

- Digital signatures.
- Official legal submissions.
- Official notarial index submission.
- AI-generated legal advice.
- AI product features other than "Crear con IA" (draft Machote generation,
  `docs/AI_TEMPLATE_GENERATION.md`).
- Storage of generated Word/PDF files, signed documents, official submission payloads, or generated document storage paths.
- Full escritura storage outside the approved persistent draft workflow.
- Full legal case management.
- Full accounting.
- Electronic invoicing.
- Enterprise multi-firm management.

## AI-Assisted Machote Rules

- The AI proposes structure only; the original document text is the source
  of truth and is reconstructed literally by LexCR.
- Every AI-generated Machote starts as `draft` and shows a visible AI
  warning; only a person publishes it through the normal step.
- Option Blocks require a known LexCR pattern, document evidence or an
  explicit lawyer instruction; in doubt, none is created.
- The Notarial Index final folio is never inferred.
- No confidence percentages are shown.

## Data Storage Rules

The application may store only what is required for MVP workflows.

Allowed data:

- Lawyer profile data.
- Document formatting preferences.
- Reusable client metadata.
- Template definitions.
- Template field definitions.
- Persistent `field_values` and Option Block selections.
- Persistent `rendered_content` text snapshots.
- The minimal versioned `template_snapshot` required to preserve the source
  Machote for each new Escritura.
- Minimal document metadata.
- Minimal notarial index metadata.
- Basic accounts receivable metadata.
- Non-sensitive audit events.

Disallowed data:

- Generated Word/PDF files.
- Signed documents.
- Official submission payloads.
- Generated document storage paths.
- Full sensitive escritura content outside the approved persistent draft workflow.
- Complete transaction details that are not required for index or billing metadata.
- Secrets.
- Credentials.
- Official submission artifacts.

When in doubt, store less.

## Document Generation Rules

Generated documents must be:

- Created from approved templates.
- Created from validated user input.
- Downloaded by the lawyer.
- Discarded by the application after generation.

Persistent escrituras may store validated values, selections, server-rendered
text and the minimal structured Machote snapshot needed for later editing and
DOCX. Preview, saving, finalization and export must use that same source. A
later Machote edit must not alter an existing Escritura. This content is
sensitive Workspace data and requires RLS, validation and no-content logging.

Generated documents must not be:

- Stored as Word/PDF files.
- Logged.
- Sent to third parties automatically.
- Submitted to official platforms automatically.
- Treated as legally reviewed by the system.

## Template Rules

Templates may include:

- Static text.
- Basic formatting.
- Variables.
- Required fields.
- Optional fields.
- Simple conditional blocks.
- Repeated party roles when needed.

Templates should be controlled and structured.

Variables referenced by any Option Block variant remain in the global variable
catalog. Required validation considers only variables active under the current
selections; shared active variables remain required. The Option Block dialog
does not expose a "Salida estructurada" control. Structured time mappings for
the notarial Index are configured in the Index step.

The product should not attempt to recreate Microsoft Word inside the browser.

The goal is to make document generation easier, not to build a full word processor.

## Client Rules

Clients are reusable metadata records.

Initial client types:

- Individual person.
- Legal entity or company.

Client data should be minimal and useful.

Do not add sensitive fields unless they are required for document generation, index metadata, or accounts receivable.

## Notarial Index Rules

The notarial index feature is an auxiliary preparation tool.

The system may help:

- Capture metadata.
- Validate missing data.
- Filter by period.
- Export prepared metadata.

The system must not:

- Submit the official index.
- Claim official compliance.
- Replace the lawyer's review.
- Connect to official platforms without explicit future approval.

Inclusion in the notarial Index is snapshotted from the Machote when an
Escritura is created and can be corrected after finalization. Confirmation and
correction operate on the exact saved metadata snapshot. `Partes` preserves the
difference between derived data, a manual override and an intentional empty
value.

## Accounts Receivable Rules

Accounts receivable is basic in the MVP.

Allowed:

- Amount.
- Status.
- Payment date.
- Related client.
- Related document metadata.
- Notes.
- Basic summary.
- Multiple payments with immutable financial totals after payments exist,
  except through the approved payment/void lifecycle.

Not included:

- Formal accounting.
- Electronic invoicing.
- Tax calculations unless explicitly approved.
- Integration with external accounting systems.

## Workspace Ownership And Authorization Rules

Application data belongs to a notarial Workspace. Access requires an active
membership and the permission assigned to one of the fixed roles:
`propietario`, `administrador`, `asistente` or `solo_lectura`.

A user must not access another Workspace's:

- Clients.
- Templates.
- Document metadata.
- Index metadata.
- Receivables.
- Settings.

Supabase RLS is required for Workspace-owned data. Sensitive lifecycle actions
such as finalization, Index confirmation/export, membership management and
settings changes remain restricted according to the server permission matrix;
the UI gate is not the authorization boundary.

## AI Rules

AI is used to assist development only.

The MVP must not include AI product features unless the product scope changes explicitly.

Do not add:

- AI legal advice.
- AI legal judgment.
- AI automatic document drafting for users.
- AI chat inside the product.
- AI review of legal content.

Future AI features require separate risk analysis.

## UX Rules

The product must be simple and practical.

Prioritize:

- Fast data entry.
- Clear forms.
- Keyboard-friendly workflows.
- Reusable clients.
- Reusable templates.
- Clear download flow.
- Clear missing-field validation.
- One explicit Guardar action per Machote/Escritura workspace, without
  auto-advance.
- Protection against navigation with unsaved changes and concurrent overwrites.

Avoid:

- Complex dashboards before core workflows work.
- Too many settings too early.
- Legal automation that creates responsibility risk.
- Overly technical language in the UI.

## Accessibility Rules

All user-facing flows must consider:

- Labels.
- Keyboard navigation.
- Visible focus.
- Clear errors.
- Logical tab order.
- Accessible dialogs.
- No reliance on color alone.

## Security Rules

Security is part of the product.

Required:

- Data minimization.
- RLS.
- Safe logging.
- Input validation.
- No generated Word/PDF file storage.
- Sensitive draft text protected by RLS and never logged.
- No service role key in browser code.
- OWASP Top 10 review mindset.

## Feature Approval Checklist

Before implementing a feature, answer:

1. Is this feature inside the MVP scope?
2. Does it store new data?
3. Is that data necessary?
4. Does it introduce sensitive legal responsibility?
5. Does it require RLS?
6. Does it affect document generation?
7. Does it affect official legal workflows?
8. Does it require tests?
9. Does it require accessibility review?
10. Does it require documentation updates?

If a feature is outside the MVP scope, do not implement it without explicit approval.

## TODO

- Validate notarial index metadata with a real anonymized example.
- Define exact client fields for MVP.
- Define exact template field types.
- Define exact document settings.
- Define audit events required for MVP.
