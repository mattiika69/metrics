# HyperOptimal Metrics

Next.js application wired for Vercel deployment and Supabase.

## Infrastructure Status

Current infrastructure rules, connection confirmations, security posture, API inventory, and remaining required external API keys are documented in [docs/infrastructure-status.md](docs/infrastructure-status.md).

The product source of truth is Supabase. Do not build durable product workflows that save user, tenant, billing, integration, messaging, AI, or operational state only to local files, browser storage, memory, or build artifacts.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from the linked Supabase project.
3. Run `npm install`.
4. Run `npm run dev`.

## Deployment

The Vercel project is configured for Next.js. Set the same Supabase environment variables in Vercel for Production, Preview, and Development.

AI-assisted workflows use the Claude API through Anthropic, not OpenAI. Set `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` as server-only Vercel environment variables before enabling AI responses.
