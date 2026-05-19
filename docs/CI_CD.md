# CI/CD

## Current CI

GitHub Actions runs on pull requests and pushes to `main` and `develop`.

The workflow:

- Installs pnpm.
- Installs dependencies with the lockfile.
- Runs lint.
- Runs typecheck when available.
- Runs tests when available.
- Runs a production build.

## Dependabot

Dependabot checks npm dependencies and GitHub Actions weekly, with open PRs limited to five per ecosystem.

## Production Deployment

The intended MVP production target is Vercel for the Next.js app and Supabase Cloud for Auth/Postgres. Production Docker deployment is not part of the MVP plan.

## TODO

- Connect Vercel after the repository is pushed.
- Add required branch protections.
- Add deployment environment documentation.
- Add migration checks after database migrations exist.
