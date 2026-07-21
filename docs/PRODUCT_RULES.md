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
- AI product features.
- Storage of generated Word/PDF files, signed documents, official submission payloads, or generated document storage paths.
- Full escritura storage outside the approved persistent draft workflow.
- Full legal case management.
- Full accounting.
- Electronic invoicing.
- Enterprise multi-firm management.

## Data Storage Rules

The application may store only what is required for MVP workflows.

Allowed data:

- Lawyer profile data.
- Document formatting preferences.
- Reusable client metadata.
- Template definitions.
- Template field definitions.
- Persistent draft `field_values`.
- Persistent draft `rendered_content` text snapshots.
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

Persistent draft escrituras may store validated `field_values` and a server-rendered text snapshot so the lawyer can continue editing later. Draft text is sensitive user-owned data and must be protected by RLS, safe validation, and no-content logging.

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

Not included:

- Formal accounting.
- Electronic invoicing.
- Tax calculations unless explicitly approved.
- Integration with external accounting systems.

## User Ownership Rules

Each independent lawyer owns their own data.

A user must not access another user's:

- Clients.
- Templates.
- Document metadata.
- Index metadata.
- Receivables.
- Settings.

Supabase RLS is required for user-owned data.

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
