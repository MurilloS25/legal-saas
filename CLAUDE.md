# Claude Instructions

Start by reading `AGENTS.md`.

`AGENTS.md` is the main routing guide for this repository. It explains which documentation files to read depending on the task.

Do not read all documentation files automatically. Read only the files relevant to the current task.

Follow the Validation Policy in `AGENTS.md`. Do not run the full pnpm validation suite for documentation-only changes unless the docs affect executable examples, package scripts, CI/CD, framework configuration, Supabase commands, or the user explicitly asks.

For UI implementation tasks, read `docs/UI_GUIDELINES.md` first.

For testing and TDD decisions, read `docs/TESTING.md` first.

## Worktree Rule

Do not create Git worktrees for this repository.

Work in the user's current worktree. When a task needs isolation, create or switch to the appropriate Git branch in the current worktree and do the work there.

Do not use `.claude/worktrees/` unless the user explicitly authorizes it.

Before starting any task, run:

```bash
git status
git branch --show-current
```

If there are unexpected local changes, stop and ask before editing.

## Development Workflow

Claude implements requested changes. Codex reviews when the user asks for review.

Do not modify files during a review-only task.

For new business modules, follow the Red-Green-Refactor TDD flow in `docs/TESTING.md`. Start with the fastest useful tests, then add limited Playwright E2E coverage for critical UI flows when applicable.

Never touch Supabase Cloud or run `supabase db push` without explicit user permission.
