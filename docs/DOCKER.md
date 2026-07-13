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

Supabase local development uses the official Supabase CLI plus Docker.

Docker Desktop must be installed and running before starting Supabase local services. The CLI is installed as a project dev dependency and should be run through pnpm.

Main commands:

```bash
pnpm supabase start
pnpm supabase status
pnpm supabase stop
```

Local service URLs:

- Supabase Studio: `http://127.0.0.1:55323`
- Local project API URL: `http://127.0.0.1:55321`
- Local Postgres port: `55432`

The local ports are configured in `supabase/config.toml` to avoid collisions
with other local Postgres/Supabase services. Do not override them ad hoc during
validation; update the config and docs together if they ever need to change.

Do not paste or commit local anon keys, service role keys, JWT secrets, database passwords, or other secrets from `pnpm supabase status`.

Do not define a manual Supabase self-hosting stack in `docker-compose.yml`. The intended local workflow is Supabase CLI managed services, not hand-maintained Docker Compose services.

If the Supabase CLI reports that a new version is available, review the official Supabase CLI docs and update the dependency in a controlled change with validation.

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

- Confirm whether the `Dockerfile` builds successfully after the app has real runtime dependencies.
