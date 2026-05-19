# AI Workflow

## Role Of AI

AI tools such as Codex and Claude may assist with development, documentation, refactoring, and tests. AI is not part of the MVP product experience.

## Required Behavior

- Read `AGENTS.md`, `RULES.md`, and `docs/PRODUCT_RULES.md` before making changes.
- Read relevant local Next.js docs in `node_modules/next/dist/docs/` before changing Next.js code.
- Keep changes scoped to the requested task.
- Do not invent product scope.
- Do not add database tables, product screens, or document-generation logic unless explicitly requested.
- Do not store generated documents or full sensitive escritura content.
- Never expose service role keys to client code.

## Review Checklist

- Does the change preserve data minimization?
- Does the change keep user-owned data behind future RLS boundaries?
- Does the change avoid misleading placeholder behavior?
- Does the change compile?
- Are TODOs explicit where implementation is deferred?

## TODO

- Add prompt examples for schema review, security review, and accessibility review after product work begins.
