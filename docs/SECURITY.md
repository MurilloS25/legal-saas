# Security

## Security Position

Security and data minimization are mandatory because the product handles legal workflows. Treat all user data as sensitive by default.

## Data Minimization

- Do not store generated legal documents.
- Do not store full sensitive escritura content.
- Store only structured metadata required for index preparation, client reuse, and accounts receivable.
- Avoid broad free-text capture unless there is a clear product and legal need.
- Redact sensitive details from logs and errors.

## Supabase And RLS

- Every user-owned table must have Row Level Security enabled before use.
- Policies must restrict reads and writes to the owning user or authorized account scope.
- RLS must be tested with positive and negative cases.
- The Supabase service role key is server-only and must never be imported into client-side code.

## OWASP Top 10:2025 Checklist

Use the current OWASP Top 10 web application categories as a review checklist:

- A01 Broken Access Control: enforce RLS, server authorization, and route protection.
- A02 Security Misconfiguration: keep secure defaults, least privilege, and reviewed environment variables.
- A03 Software Supply Chain Failures: use lockfiles, Dependabot, and CI checks.
- A04 Cryptographic Failures: use managed TLS and avoid custom cryptography.
- A05 Injection: validate input and use parameterized database access.
- A06 Insecure Design: review abuse cases before implementing workflows.
- A07 Authentication Failures: rely on Supabase Auth and protect sessions.
- A08 Software or Data Integrity Failures: protect CI/CD, dependencies, and generated artifacts.
- A09 Security Logging and Alerting Failures: log security events without sensitive legal content.
- A10 Mishandling of Exceptional Conditions: return safe errors and avoid leaking internals.

Reference: https://owasp.org/Top10/2025/

## Secrets

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` may be exposed to browser code.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only.
- Never commit real `.env` files.
- Never print secrets in CI output.

## TODO

- Add threat model for auth, metadata, and document export flows.
- Define audit logging requirements.
- Add security test cases after schema and auth are implemented.
