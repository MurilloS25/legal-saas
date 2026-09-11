# CI/CD

## Goal

The goal of CI/CD is to keep the MVP stable, secure, and deployable.

The pipeline should catch common problems before changes are merged.

## Tools

The project uses:

- GitHub Actions for CI.
- Dependabot for dependency update pull requests.
- Vercel for Preview deployments and the existing Production deployment.
- Supabase Cloud for managed backend services.

## Branch Strategy

Recommended branches:

```txt
main
develop
feature/*
fix/*
docs/*
```

Branch responsibilities:

- `main`: production-ready code.
- `develop`: integration branch.
- `feature/*`: feature work.
- `fix/*`: bug fixes.
- `docs/*`: documentation changes.

## Pull Request Rules

Pull requests should be required for:

- Merging into `develop`.
- Merging into `main`.

Before merge, the project should pass:

- Install.
- Lint.
- Typecheck.
- Tests.
- Build.

## CI Workflow

The base CI workflow should run on:

- Pull requests to `develop`.
- Pull requests to `main`.
- Pushes to `develop`.
- Pushes to `main`.

Required checks:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Testing In CI

The unit-test script currently uses:

```bash
vitest run --passWithNoTests
```

The repository has substantive Vitest coverage. `--passWithNoTests` remains a
script compatibility flag and must not be interpreted as permission to omit
tests for critical logic.

## Dependabot

Dependabot should monitor:

- npm dependencies.
- GitHub Actions dependencies.

Recommended schedule:

- Weekly npm updates.
- Weekly GitHub Actions updates.
- Maximum 5 open pull requests per ecosystem.

## Security In CI/CD

CI/CD must follow these rules:

- Do not print secrets.
- Do not commit real `.env` files.
- Use least-privilege GitHub token permissions when workflows become more advanced.
- Do not deploy from unreviewed branches.
- Do not run unknown external scripts without review.
- Review dependency update pull requests before merging.

## Deployment Strategy

The intended production path is:

```txt
GitHub main branch
  ↓
Vercel production deployment
  ↓
Supabase Cloud
```

Vercel Preview deployments are enabled for pull requests. They must not receive
Supabase Production credentials automatically. Vercel Production deploys from
`main`; merging to `develop` does not promote Production.

## Environments

Current environments are:

- Local.
- Preview.
- Production.

Environment rules:

```txt
Local: Supabase local public URL/key; service-role only in server-side test tooling
Preview: no automatic access to Supabase Production
Production: NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

The application does not require a service-role key in Vercel. Any future use
must remain server-only and requires a separate security review.

## Release Flow

Recommended release flow:

```txt
feature branch
  ↓
pull request to develop
  ↓
CI passes
  ↓
merge to develop
  ↓
testing / review
  ↓
pull request to main
  ↓
CI passes
  ↓
merge to main
  ↓
production deployment
```

Supabase migrations are not pushed automatically by CI. They are versioned,
tested locally and applied to Cloud only as an explicitly authorized,
coordinated release step. See `docs/SUPABASE_PRODUCTION.md` and
`docs/VERCEL_PRODUCTION.md` for dated operational state.
