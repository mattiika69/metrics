# Metrics

Next.js application wired for Vercel deployment and Supabase.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from the linked Supabase project.
3. Run `npm install`.
4. Run `npm run dev`.

## Deployment

The Vercel project is configured for Next.js. Set the same Supabase environment variables in Vercel for Production, Preview, and Development.
