# MVP Scope

## Product Goal

Help independent lawyers in Costa Rica manage reusable legal document templates ("machotes") and the minimal structured metadata needed for client reuse, notarial index preparation, and accounts receivable.

## Included In MVP

- Multi-user accounts through Supabase Auth.
- Template catalog and template editing workflow for reusable machotes.
- Generation of editable Word documents from approved templates.
- Client metadata reuse for recurring legal work.
- Structured metadata capture for notarial index preparation.
- Basic accounts receivable tracking related to matters or documents.
- User-owned data isolation through Supabase RLS.
- Security, accessibility, and data minimization from the first release.

## Excluded From MVP

- Storing generated legal documents.
- Storing full sensitive escritura content.
- Digital signatures.
- Official legal or notarial submissions.
- Official notarial index submission.
- Automated legal responsibility, legal judgment, or legal advice.
- AI product features.
- Self-hosted production Docker deployment.

## Data Boundaries

The system may store only structured metadata that is necessary for product workflows. Generated Word files should be produced for download or handoff and then discarded by the application.

## TODO

- Define the exact metadata fields after a schema design task.
- Validate Costa Rica-specific workflows with practicing lawyers.
- Decide which MVP flows require audit logs.
