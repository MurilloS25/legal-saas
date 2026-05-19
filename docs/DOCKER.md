# Docker

## Purpose

Docker is optional local-development support. It is not the MVP production deployment strategy.

Production is intended to run on Vercel plus Supabase Cloud.

## Supabase Local Development

Use the Supabase CLI for the local Supabase stack. The `docker-compose.yml` file intentionally does not attempt to define or self-host production Supabase services manually.

## App Container

The `Dockerfile` provides an optional future container build for the Next.js app. Normal local app development should use:

```bash
pnpm dev
```

To build the optional app image through Compose:

```bash
docker compose --profile app build
```

To run it:

```bash
docker compose --profile app up app
```

## TODO

- Add Supabase CLI setup notes after the local project is initialized.
- Decide whether the app container is useful for CI smoke testing.
