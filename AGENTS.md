# Repository Operating Rules

## Cloud Source of Truth

Everything durable must be written to and synced with the cloud.

- Do not treat local files as the source of truth.
- Do not leave completed work only on the local machine.
- Commit and push every finished code, configuration, documentation, migration, and design change to `main`.
- Sync deployment configuration and environment variables to the appropriate cloud service when credentials permit it.
- Use local files only as temporary working state required by editors, build tools, package managers, or CLIs.
- If a change cannot be synced because credentials or permissions are missing, state the blocker clearly and do not claim the work is complete.
- Before finishing a task, verify the relevant cloud destination is updated or explicitly report what remains unsynced.

## Default Workflow

- Keep changes small and task-scoped.
- Preserve user work and avoid overwriting unrelated changes.
- Run the smallest relevant verification before pushing.
- Prefer cloud-connected workflows: GitHub for source, Vercel for deployment, and Supabase for database/configuration.
