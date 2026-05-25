# Claude Instructions

Start by reading `AGENTS.md`.

`AGENTS.md` is the main routing guide for this repository. It explains which documentation files to read depending on the task.

Do not read all documentation files automatically. Read only the files relevant to the current task.

Follow the Validation Policy in `AGENTS.md`. Do not run the full pnpm validation suite for documentation-only changes unless the docs affect executable examples, package scripts, CI/CD, framework configuration, Supabase commands, or the user explicitly asks.

For UI implementation tasks, read `docs/UI_GUIDELINES.md` first.

## Worktree Rule

Do not create Git worktrees for this repository.

Work in the user's current worktree. When a task needs isolation, create or switch to the appropriate Git branch in the current worktree and do the work there.
