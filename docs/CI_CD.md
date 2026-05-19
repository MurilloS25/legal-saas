# CI/CD

## Goal

The goal of CI/CD is to keep the MVP stable, secure, and deployable.

The pipeline should catch common problems before changes are merged.

## Tools

The project uses:

- GitHub Actions for CI.
- Dependabot for dependency update pull requests.
- Vercel for future production deployment.
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

The initial project may use:

```bash
vitest run --passWithNoTests
```

This is allowed only during the foundation phase.

After critical business logic is added, the project should include real tests and eventually remove the dependency on passing with no tests.

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

Preview deployments may be enabled later for pull requests.

## Environments

Future environments may include:

- Local.
- Preview.
- Production.

Potential environment variable groups:

```txt
Local:
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

Preview:
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

Production:
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

The service role key must remain server-only in every environment.

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

## TODO

- Add Vercel deployment details after the project is connected to Vercel.
- Add preview deployment rules.
- Add branch protection rules in GitHub.
- Add CodeQL or another security scanning workflow if needed.
- Add Supabase migration workflow after database schema is approved.
