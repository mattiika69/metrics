# Email With Resend

HyperOptimal Metrics uses Resend for transactional and workflow email.

## Environment Variables

- `RESEND_API_KEY`: server-only Resend API key.
- `RESEND_FROM_EMAIL`: verified sender address, for example `HyperOptimal Metrics <noreply@example.com>`.

## Rules

- Email sends must be tenant-scoped.
- The sending user must be authenticated and a member of the tenant.
- Sent email records are stored in `email_messages`.
- `RESEND_API_KEY` must never be exposed to browser code.
- Future tenant-specific domains or sender identities must be stored server-side and protected by tenant RLS.

## Configured Email Types

Supabase Auth emails are configured through Resend SMTP:

- Signup confirmation
- Password reset/recovery
- Magic link login
- User invitation
- Email change confirmation
- Password changed security notification
- Email changed security notification

Product emails are supported through the server-side Resend helper and tenant-scoped `email_messages` logging:

- Workspace created
- Admin invited
- Team invited
- Billing needs attention
- Integration connected
