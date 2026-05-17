# Contributing

## Workflow

- Read `AGENTS.md` before editing.
- Load `PRODUCT.md`, `DESIGN.md`, and `TESTING_GUIDE.md` when the task touches those areas.
- Keep changes small, focused, and task-scoped.
- Inspect relevant files before non-trivial edits.
- Give a short plan before editing when the task is non-trivial.
- Do not rewrite architecture unless explicitly requested.
- Do not add dependencies unless necessary.
- Preserve existing API shapes unless the user explicitly approves a breaking change.

## Code Conventions

- Use TypeScript and existing Next.js App Router patterns.
- Prefer server components for data loading and server actions or route handlers for writes.
- Keep service role access in server-only utilities.
- Do not expose secrets or private provider tokens to the browser.
- Use existing Supabase client helpers instead of creating duplicate clients.
- Use existing tenant, membership, billing, integration, and audit helpers where available.
- Keep comments rare and useful, especially around security-sensitive code.

## Persistence Rules

- Supabase/Postgres is the source of truth for durable app data.
- Stripe is the billing source of truth, and billing state must sync into Supabase through trusted server-side webhooks.
- Do not store real app state in browser storage, local JSON files, mock stores, hardcoded constants, or frontend-only state.
- Client state is allowed only for temporary UI state such as selected tabs, open panels, unsaved drafts, filters, loading states, and optimistic UI that reconciles with persisted state.

## UI Rules

- Use Montserrat everywhere.
- Use the Scaling Metrics-style app shell unless the user explicitly changes direction.
- Keep pages client-facing. Do not render internal notes, implementation status, architecture language, or setup commentary.
- For UI work, use the impeccable skill when available.
- Keep desktop workflows dense, stable, and polished. Keep mobile usable.

## Verification

Run the smallest relevant checks before completion. Typical checks:

```bash
npm run build
npx tsc --noEmit --incremental false
```

Run `npm run lint` and `npm run test:e2e` when applicable and available. If a local environment blocks a check, report the exact blocker and verify through GitHub Actions when possible.

## Git And Cloud Sync

- Commit author must be `mattiika69 <matt@1000xleads.com>`.
- Push finished work to GitHub `main`.
- Verify GitHub Actions and Vercel production deployment after pushing.
- If credentials or permissions block cloud sync, report exactly what remains unsynced.

## TODO

- Document branch protection expectations once GitHub rules are finalized.
- Add a stable release checklist for paid customer launches.

