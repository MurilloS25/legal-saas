# Security

## Security Position

Security and data minimization are mandatory because the product supports legal workflows.

Treat all user data as sensitive by default.

The product must help lawyers work faster without becoming a risky storage system for generated Word/PDF files, signed documents, official submissions, or unnecessary sensitive legal content.

## Core Security Principles

The MVP follows these principles:

- Data minimization.
- Least privilege.
- Defense in depth.
- Secure defaults.
- Explicit authorization.
- Safe error handling.
- Safe logging.
- Dependency hygiene.
- OWASP Top 10 awareness.
- Accessibility and security considered together in form-heavy workflows.

## Data Minimization

The application must not store:

- Generated Word/PDF files.
- Signed documents.
- Official submission payloads.
- Generated document storage paths.
- Full sensitive escritura content outside the approved persistent draft workflow.
- Unnecessary details about legal transactions.
- Secrets.
- Credentials.
- Official submission artifacts.

The application may store:

- Lawyer profile data.
- Template definitions.
- Template field definitions.
- Persistent `field_values` and Option Block selections.
- Persistent `rendered_content` text snapshots.
- Persistent `template_snapshot` structured content, limited to the Machote document and configured field metadata needed to reopen and export the Escritura consistently; derived variables are reconstructed from that document instead of duplicated.
- Client metadata.
- Minimal document metadata.
- Minimal notarial index metadata.
- Accounts receivable metadata.
- Non-sensitive audit events.

When in doubt, store less.

## Supabase And RLS

Supabase Row Level Security is mandatory for Workspace-owned data.

Every Workspace-owned table must:

- Include `workspace_id` and preserve `owner_id` where the current schema uses it
  for creator/audit compatibility.
- Enable RLS before production use.
- Define policies for select, insert, update, and delete when applicable.
- Restrict access to active Workspace membership and the required fixed role.
- Be tested with allowed and denied access cases.

Current policy idea:

```sql
is_workspace_member(workspace_id, allowed_roles)
```

RLS is not optional.

Frontend filtering is not authorization.

## Secrets

Environment variables must follow these rules:

- `NEXT_PUBLIC_SUPABASE_URL` may be used in browser code.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` may be used in browser code.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only.
- `SUPABASE_SERVICE_ROLE_KEY` must never be imported into client-side code.
- Real `.env` files must never be committed.
- Secrets must never be printed in CI logs.
- Secrets must never be sent to client components.

## OWASP Top 10 Checklist

Use OWASP Top 10 as a security review checklist for web application risks.

This project uses the OWASP Top 10 2021 categories as the initial baseline because they are widely used for web application security training and review.

### A01 Broken Access Control

Main project risk.

Examples to prevent:

- A lawyer reading another lawyer's clients.
- A lawyer modifying another lawyer's templates.
- A lawyer accessing another lawyer's receivables by changing an ID.
- Dashboard routes showing private data without an authenticated session.

Required controls:

- Supabase RLS.
- Server-side authorization checks.
- Protected routes.
- Ownership validation.
- Negative tests for unauthorized access.

### A02 Cryptographic Failures

Required controls:

- Use managed HTTPS in production.
- Do not implement custom cryptography.
- Do not store unnecessary sensitive legal content.
- Do not store generated Word/PDF files, signed documents, official submissions, or generated document storage paths.
- Protect secrets and environment variables.
- Avoid logging sensitive data.

### A03 Injection

Required controls:

- Validate input with schemas before persistence.
- Avoid raw SQL string concatenation.
- Avoid unsafe HTML rendering.
- Sanitize or strictly control rich text/template content.
- Validate template variables against allowed field definitions.
- Avoid dynamic code execution.

### A04 Insecure Design

Required controls:

- Review abuse cases before implementing workflows.
- Keep official legal submission outside MVP scope.
- Keep digital signature outside MVP scope.
- Avoid storing generated documents by design.
- Separate document metadata, index metadata, and receivables.
- Review new features against `MVP_SCOPE.md`.

### A05 Security Misconfiguration

Required controls:

- Secure environment variable handling.
- No debug-only routes in production.
- No broad database policies.
- No public unrestricted tables for Workspace-owned data.
- Review Supabase policies before deployment.
- Use secure defaults in CI/CD.

### A06 Vulnerable And Outdated Components

Required controls:

- Use lockfiles.
- Use Dependabot.
- Review dependency updates.
- Avoid unnecessary dependencies.
- Prefer reputable libraries.
- Run CI checks before merging dependency updates.

### A07 Identification And Authentication Failures

Required controls:

- Use Supabase Auth.
- Protect private dashboard routes.
- Handle session state safely.
- Use secure password reset flows through the auth provider.
- Do not implement custom authentication unless explicitly approved.

### A08 Software And Data Integrity Failures

Required controls:

- Use pull requests.
- Run CI before merging.
- Protect `main`.
- Use package lockfiles.
- Avoid executing unreviewed scripts.
- Avoid committing generated artifacts that should not be versioned.

### A09 Security Logging And Monitoring Failures

Required controls:

- Log important security-relevant events without sensitive legal content.
- Do not log generated document file content.
- Do not log persistent `field_values`, `rendered_content` or `template_snapshot`.
- Do not log full escritura text.
- Do not log secrets.
- Capture enough operational context to investigate failures safely.

Potential audit events:

- Login.
- Profile update.
- Template creation.
- Template update.
- Document generation event without generated content.
- Index export event.
- Receivable status update.

### A10 Server-Side Request Forgery

Current MVP risk is low because the app should not fetch arbitrary user-provided URLs.

Required controls if future imports are added:

- Do not fetch arbitrary URLs from user input.
- Validate file uploads.
- Validate file size and type.
- Block internal network targets.
- Avoid server-side URL fetch features unless explicitly reviewed.

## Template And Rich Text Security

Template editing is a sensitive area.

Rules:

- Do not execute template content as code.
- Do not allow arbitrary scripts.
- Validate variable names against known fields.
- Keep conditional syntax controlled.
- Avoid rendering unsanitized HTML.
- Prefer structured template content over raw HTML-only storage.

## Document Generation Security

Generated documents and persistent Escritura content must be handled carefully.

Rules:

- Generate files for immediate download.
- Persist `field_values`, selections, server-rendered text snapshots and the
  minimal structured template snapshot only in the approved Workspace-owned
  `documents` model.
- Do not persist generated Word/PDF files.
- Avoid writing generated files to permanent storage.
- Avoid logging draft values, rendered snapshots, structured template snapshots, or generated content.
- Keep export adapters server-side.
- Validate all input before export.

## AI-Assisted Machote Generation Security

"Crear con IA" treats the uploaded document, the pasted text, the optional
variant instructions and the model output as untrusted input. The model has
no tools and no secrets, returns strict JSON that LexCR re-validates, and
never writes to the database; the backend creates a draft with the user's
session after validation, and publication stays human. Source documents are
processed in memory and never persisted or logged. Quotas are enforced by
service-role-only RPCs. The full layered security model (trust boundary,
instruction/data separation, no tools, no secrets, structured output + Zod,
domain validators, deterministic reconstruction, authorization, Workspace
isolation, draft-only, upload security, logging, quotas, CSRF, XSS, prompt
leakage and honest limitations) is section 5 of
`docs/AI_TEMPLATE_GENERATION.md`.

## Logging Rules

Logs must not include:

- Generated Word/PDF document content.
- Persistent `field_values`, `rendered_content` or `template_snapshot`.
- Full escritura content.
- Secrets.
- Credentials.
- Complete sensitive transaction details.
- Full client identification details unless explicitly required for safe debugging.
- AI source documents, extracted text, variant instructions, prompts or model responses.

Logs may include:

- Event type.
- User ID.
- Timestamp.
- Non-sensitive resource ID.
- Error code.
- Safe technical context.

## CI/CD Security

CI/CD must:

- Run lint.
- Run typecheck.
- Run tests.
- Run build.
- Avoid printing secrets.
- Avoid using overly broad GitHub token permissions.
- Run on pull requests before merge.

## Dependency Security

Use Dependabot for:

- npm dependencies.
- GitHub Actions dependencies.

Dependency updates should be reviewed before merging.

Avoid adding libraries unless they have a clear purpose.

## Security Review Checklist For New Features

Before merging a new feature, answer:

1. Does it store any new user data?
2. Is the data necessary?
3. Does the table require RLS?
4. Can one user access another user's data?
5. Are inputs validated?
6. Are errors safe?
7. Are logs safe?
8. Does it expose secrets?
9. Does it render user-controlled HTML?
10. Does it change document generation behavior?
11. Does it affect official legal workflows?
12. Does it require tests?

## Auth Hardening Checklist

The following items are required before production deployment of Supabase Auth.
They are intentionally deferred from the MVP development phase.

### Rate Limits

Supabase Auth has built-in rate limits for signup, login, OTP, and password reset.

Before production:

- Review the rate limit settings in the Supabase project dashboard.
- Consider enabling CAPTCHA (hCaptcha or Cloudflare Turnstile) via Supabase Auth settings
  if bot traffic or credential stuffing becomes a concern.
- Do not implement manual rate limiting in application code unless Supabase limits are insufficient.

### CAPTCHA

CAPTCHA integration is deferred.

Supabase Auth natively supports hCaptcha and Cloudflare Turnstile.
Enable and configure via the Supabase Auth project settings when needed.

### Password Policy Alignment

The application enforces a password policy at the form validation layer (Zod schema).
The Supabase Auth project settings have a separate password strength configuration.

Before production:

- Set the Supabase Auth password minimum length to 12 characters to match the application schema.
- Enable uppercase, lowercase, digit, and symbol requirements in Supabase Auth settings.
- Both layers must be aligned — the application layer provides UX feedback;
  the Supabase layer enforces the policy at the API level.

### Custom SMTP

Before production:

- Configure a custom SMTP server in Supabase project settings.
- Using Supabase's default SMTP has rate limits not suitable for production.

### Email Confirmation Templates

Before production:

- Update the Supabase email confirmation template to point to:
  `<your-domain>/auth/confirm?token_hash={{ .TokenHash }}&type=signup`
- Review all email templates (confirmation, password reset, invite) in Supabase project settings.

### Deferred Auth Features

The following features are intentionally deferred:

- Google OAuth (and other social providers).
- Magic link / passwordless login.
- Multi-factor authentication (MFA / TOTP).
- Passkeys / WebAuthn.

## TODO

- Define exact RLS policies after the database schema is approved.
- Add threat model for authentication.
- Add threat model for template editing.
- Add threat model for document export.
- Add threat model for notarial index metadata.
- Define audit log requirements.
- Add security-focused test cases.
