# HyperOptimal Metrics Product Context

## Register

product

## Product Purpose

HyperOptimal Metrics is a desktop-first SaaS dashboard for operators who need one cloud-backed source of truth for company metrics, benchmarks, constraints, forecasting, integrations, and team settings.

## Primary Users

- Founders and CEOs who want a fast operating snapshot without digging through disconnected tools.
- Operators and team leads who review financial, retention, sales, and input performance repeatedly.
- Admins who manage billing, team access, integrations, Slack, Telegram, scheduling, email, and SMS setup.

## Product Principles

- Cloud persistence comes first. Durable product data must save to Supabase or the correct cloud provider before success is shown.
- The app is primarily desktop software. It should be dense, calm, legible, and optimized for repeated use.
- Mobile should remain usable, but desktop is the canonical experience.
- The UI should feel like a serious SaaS tool, not a marketing page.
- Client-facing pages must contain product copy only. No internal notes, implementation language, TODOs, engineering status, or provider setup commentary.
- Data loss is unacceptable. Empty, loading, and error states must be explicit and recoverable.
- Auth, tenant isolation, RLS, Stripe readiness, Slack/Telegram readiness, Resend, Roezan, and Claude server-side boundaries are part of the product foundation.

## Design Direction

Use the Scaling Metrics-style app shell as the visual baseline: dark compact sidebar, restrained light workspace, Montserrat typography, small pill tabs, dense tables, and quiet controls. Use familiarity and consistency over decoration.

## Anti-References

- No decorative hero sections inside the app.
- No colorful utility tabs unrelated to the current product workflow.
- No internal notes on client pages.
- No local-only persistent state.
- No duplicated navigation tabs when the sidebar already carries the page hierarchy.
- No oversized cards or inflated typography for operational pages.

