# Claude Instructions

Follow `AGENTS.md`, `RULES.md`, and `docs/PRODUCT_RULES.md`.

Before changing Next.js code, read the relevant guide in `node_modules/next/dist/docs/` because this project uses a newer Next.js version with breaking changes.

Core constraints:

- Do not implement product screens until explicitly requested.
- Do not create database tables until a schema task is approved.
- Do not add document-generation logic yet.
- Do not store generated legal documents or full sensitive escritura content.
- Never expose Supabase service role keys to client-side code.
- Keep the modular monolith boundaries clear and avoid overengineering.
