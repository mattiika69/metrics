# Testing Guide

## Default Verification

Run the smallest relevant checks for the change. For most frontend and app-shell changes:

```bash
npm run build
npx tsc --noEmit --incremental false
```

Run lint when the configured script is available:

```bash
npm run lint
```

Run Playwright smoke tests when the browser runtime is available:

```bash
npm run test:e2e
```

On this machine, local Chromium may be blocked by the macOS sandbox. If that happens, rely on the GitHub Actions Playwright workflow on Linux and report the local limitation.

## MVP Smoke Coverage

The MVP smoke suite should cover:

- Public app route loads.
- Protected app routes redirect unauthenticated users.
- Admin routes deny unauthenticated and non-admin access.
- Login, signup, and password reset pages render.
- Core dashboard pages render without synced data.
- Settings pages render account, team, billing, integrations, scheduling, Slack, and Telegram tabs.
- Durable write flows persist through Supabase-backed server actions or API routes.

## Security Checks

For auth, billing, integration, email, SMS, and admin changes, verify:

- Service role keys stay server-only.
- Browser code receives only public environment variables.
- RLS is not disabled or weakened.
- API routes authenticate and tenant-check before writes.
- Webhook routes verify signatures or shared secrets before processing.
- Persistent user-facing state is not stored only in browser storage, local files, mock stores, or hardcoded arrays.

## Cloud Checks

Before claiming completion for pushed work:

- Push to GitHub `main`.
- Confirm GitHub Actions build checks pass.
- Confirm Playwright workflow passes when applicable.
- Confirm Vercel production deployment is tied to the pushed commit.
- Confirm Supabase migrations are applied when schema changed.

## TODO

- Add focused Playwright smoke tests for the most important dashboard, settings, and admin access paths as product flows stabilize.
- Add a documented manual QA checklist for Stripe, Resend, Roezan, Slack, and Telegram production credentials.

