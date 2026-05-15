# SMS With Roezan

HyperOptimal Metrics uses Roezan for SMS and MMS sends.

## Environment Variables

- `ROEZAN_API_KEY`: server-only Roezan API key.
- `ROEZAN_API_BASE_URL`: Roezan API base URL. Default: `https://app.roezan.com/api`.

## API Notes

The Roezan live API base URL is `https://app.roezan.com/api`, and SMS sends use `/integrations/message/send`.

Although the public Swagger spec lists Basic Auth, the live API accepts the account API key in the `x-api-key` header.

## Rules

- SMS sends must be tenant-scoped.
- The sending user must be authenticated and a member of the tenant.
- Sent SMS records are stored in `sms_messages`.
- `ROEZAN_API_KEY` must never be exposed to browser code.
- Future opt-out, consent, and quiet-hour enforcement must happen before automated campaign sends.
