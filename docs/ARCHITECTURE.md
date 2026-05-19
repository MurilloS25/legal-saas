# Architecture

## Overview

This application is a modular monolith built with Next.js App Router, TypeScript, Tailwind CSS, and Supabase. The production target is Vercel plus Supabase Cloud. Docker is local-development support only.

## Modular Monolith

The codebase is organized by product capability while remaining deployable as one application. This keeps the MVP simple without giving up clear ownership boundaries.

## Source Layout

- `src/app`: Next.js App Router routes, layouts, route handlers, and metadata.
- `src/components`: shared UI, layout, and form primitives.
- `src/domain`: business language and rules with no framework dependencies.
- `src/application`: use cases and orchestration.
- `src/infrastructure`: Supabase, repositories, and external adapters.
- `src/features`: feature-level composition for clients, templates, documents, notarial index, receivables, and settings.
- `src/lib`: validations, utilities, and constants.

## Dependency Direction

Domain code must not import application, infrastructure, features, React, Next.js, or Supabase. Application code may depend on domain contracts. Infrastructure implements those contracts. Features and routes compose use cases and UI.

## Supabase

Supabase will provide Auth, Postgres, and RLS-based authorization. RLS policies are mandatory before real user-owned data is stored.

## Deployment

The MVP production path is Vercel for the Next.js app and Supabase Cloud for backend services. Docker is not the production hosting strategy.

## TODO

- Add Supabase server/client helpers after auth flow design.
- Define repository interfaces when the first schema exists.
- Add route groups only when actual screens are planned.
