# Docker Strategy

## Decision

Docker is used for local development support.

Docker is not required for the MVP production deployment.

The intended MVP production target is:

```txt
Vercel - Next.js app
Supabase Cloud - Auth and Postgres
```

The intended local development target is:

```txt
Local Next.js app
Supabase local stack through Docker
```

## Why Docker Is Useful Locally

Docker helps provide a reproducible local development environment.

In this project, Docker is mainly useful for:

- Running the Supabase local stack.
- Running local Postgres through Supabase.
- Testing migrations before applying them to cloud environments.
- Avoiding manual local database setup.
- Supporting a professional development workflow for the master's project.

## Why Docker Is Not Required In MVP Production

For the MVP, production deployment should be simple.

Using Vercel plus Supabase Cloud avoids the need to manage:

- Linux servers.
- Container registries.
- Reverse proxies.
- TLS certificates.
- Manual container restarts.
- Server patching.
- Self-hosted Supabase operations.
- Production database backups at the infrastructure level.

This keeps the MVP focused on product value instead of infrastructure complexity.

## Docker Files

The repository may include:

- `Dockerfile`: optional future container build for the Next.js app.
- `docker-compose.yml`: local development helper.
- `.dockerignore`: excludes files that should not be copied into Docker build contexts.

These files do not mean that production must use Docker.

## Local Supabase

Supabase local development requires Docker.

Typical local workflow:

```bash
supabase start
```

This starts the local Supabase services.

The exact commands may change after the Supabase project is initialized.

## Local App

The Next.js app can run directly on the developer machine:

```bash
pnpm dev
```

The app does not need to run inside Docker during normal development.

## Production

Production MVP deployment is expected to use:

```txt
GitHub
  ↓
Vercel
  ↓
Supabase Cloud
```

Docker-based production deployment may be reconsidered in the future if the project requires:

- Self-hosting.
- Custom infrastructure.
- Enterprise deployment.
- Non-Vercel hosting.
- More control over runtime behavior.

## Rules

- Do not self-host Supabase for MVP production.
- Do not make Docker a requirement for deploying the MVP.
- Do not store secrets in Docker files.
- Do not copy `.env` into Docker images.
- Keep Docker configuration simple.
- Document any production Docker decision before implementing it.

## TODO

- Confirm the exact Supabase local setup after `supabase init`.
- Confirm whether the `Dockerfile` builds successfully after the app has real runtime dependencies.
- Add Docker-related commands to `README.md` after the workflow is stable.
