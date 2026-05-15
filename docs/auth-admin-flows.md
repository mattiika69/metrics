# Auth and Admin Flows

HyperOptimal Metrics includes baseline SaaS account and admin flows from the start.

## Public Flows

- `/signup`: create a Supabase Auth account.
- `/login`: log in with email and password.
- `/forgot-password`: request a secure reset link.
- `/reset-password`: set a new password after Supabase email confirmation.
- `/privacy`: privacy policy.
- `/terms`: terms of service.

## Authenticated Flows

- `/get-started`: post-signup onboarding for account, Stripe billing handoff, and workspace setup.
- `/onboarding`: compatibility redirect to `/get-started`.
- `/dashboard`: protected tenant workspace home.
- `/account`: user profile, membership, and password reset entry point.
- `/admin`: tenant-level admin readiness for users, billing, integrations, and compliance.
- `/settings/team`: tenant team settings with member list, admin/member invitations, and pending invitation management.
- `/settings/team/accept`: invitation acceptance flow for existing users or new signups.

## Security Rules

- Auth is handled by Supabase Auth.
- Auth emails are sent through Resend SMTP with branded HyperOptimal Metrics templates.
- Protected pages require a signed-in user.
- Tenant pages require membership in `tenant_memberships`.
- Tenant data access is backed by Supabase RLS.
- Team invitations are tenant-scoped, expire, and can only be accepted by a signed-in user whose email matches the invitation.
- Admin controls are tenant-scoped and must remain compatible with billing, Slack, Telegram, Resend, and Roezan foundations.
