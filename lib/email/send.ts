import "server-only";

import { createHash } from "node:crypto";
import { createResendClient, getDefaultFromEmail } from "@/lib/email/resend";
import { logAuditEvent } from "@/lib/security/audit";
import { createAdminClient } from "@/lib/supabase/admin";

const FALLBACK_FROM_EMAIL = "not-configured@hyperoptimal.invalid";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type SendTenantEmailInput = {
  tenantId: string | null;
  actorUserId: string | null;
  to: string[];
  subject: string;
  text?: string;
  html?: string;
  template?: string;
  idempotencyKey?: string | null;
  metadata?: Record<string, unknown>;
};

export type SendTenantEmailResult = {
  ok: boolean;
  emailMessageId: string | null;
  providerMessageId: string | null;
  error: string | null;
};

export function normalizeEmailRecipients(recipients: string[]) {
  return Array.from(
    new Set(
      recipients
        .map((recipient) => recipient.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

export function isValidEmailAddress(email: string) {
  return EMAIL_PATTERN.test(email);
}

function serializeError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Email could not be sent.";
}

export function normalizeEmailIdempotencyKey(value: string | null | undefined) {
  const normalized = value?.trim();
  if (!normalized) return null;
  return normalized.slice(0, 200);
}

function defaultEmailIdempotencyKey(input: SendTenantEmailInput, recipients: string[]) {
  const hourBucket = new Date().toISOString().slice(0, 13);
  const hash = createHash("sha256")
    .update(JSON.stringify({
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      recipients,
      subject: input.subject,
      text: input.text ?? null,
      html: input.html ?? null,
      template: input.template ?? null,
      hourBucket,
    }))
    .digest("hex");

  return `email:${hash}`;
}

function configuredFromEmail() {
  try {
    return getDefaultFromEmail();
  } catch {
    return process.env.EMAIL_FROM ?? process.env.RESEND_FROM_EMAIL ?? FALLBACK_FROM_EMAIL;
  }
}

function emailPayload(
  input: SendTenantEmailInput,
  idempotencyKey: string,
  extra?: Record<string, unknown>,
) {
  return {
    template: input.template ?? null,
    idempotencyKey,
    recipientCount: input.to.length,
    ...(input.metadata ?? {}),
    ...(extra ?? {}),
  };
}

export async function sendTenantEmail(input: SendTenantEmailInput): Promise<SendTenantEmailResult> {
  const recipients = normalizeEmailRecipients(input.to);
  const idempotencyKey =
    normalizeEmailIdempotencyKey(input.idempotencyKey) ??
    defaultEmailIdempotencyKey(input, recipients);
  const invalidRecipient = recipients.find((recipient) => !isValidEmailAddress(recipient));

  if (recipients.length === 0) {
    return {
      ok: false,
      emailMessageId: null,
      providerMessageId: null,
      error: "At least one valid recipient is required.",
    };
  }

  if (invalidRecipient) {
    return {
      ok: false,
      emailMessageId: null,
      providerMessageId: null,
      error: `Invalid recipient: ${invalidRecipient}`,
    };
  }

  if (!input.text && !input.html) {
    return {
      ok: false,
      emailMessageId: null,
      providerMessageId: null,
      error: "Email content is required.",
    };
  }

  const admin = createAdminClient();
  const from = configuredFromEmail();
  const { data: emailMessage, error: insertError } = await admin
    .from("email_messages")
    .insert({
      tenant_id: input.tenantId,
      created_by: input.actorUserId,
      provider: "resend",
      provider_message_id: null,
      from_email: from,
      to_emails: recipients,
      subject: input.subject,
      status: "queued",
      idempotency_key: idempotencyKey,
      payload: emailPayload(input, idempotencyKey),
    })
    .select("id")
    .single();

  if (insertError || !emailMessage) {
    if (insertError?.code === "23505") {
      let query = admin
        .from("email_messages")
        .select("id, provider_message_id, status")
        .eq("idempotency_key", idempotencyKey);
      query = input.tenantId
        ? query.eq("tenant_id", input.tenantId)
        : query.is("tenant_id", null);
      const { data: existingMessage } = await query.maybeSingle();

      if (existingMessage) {
        const failed = existingMessage.status === "error";
        return {
          ok: !failed,
          emailMessageId: existingMessage.id,
          providerMessageId: existingMessage.provider_message_id,
          error: failed ? "Duplicate email send failed previously." : null,
        };
      }
    }

    return {
      ok: false,
      emailMessageId: null,
      providerMessageId: null,
      error: insertError?.message ?? "Email could not be recorded.",
    };
  }

  let resend;
  let sendFrom;
  try {
    resend = createResendClient();
    sendFrom = getDefaultFromEmail();
  } catch (error) {
    const message = serializeError(error);
    await admin
      .from("email_messages")
      .update({
        status: "error",
        payload: emailPayload(input, idempotencyKey, {
          error: message,
          failureStage: "configuration",
        }),
      })
      .eq("id", emailMessage.id);
    await logAuditEvent({
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      eventType: "email_send_failed",
      targetType: "email_message",
      targetId: emailMessage.id,
      metadata: {
        subject: input.subject,
        recipientCount: recipients.length,
        error: message,
      },
    });
    return {
      ok: false,
      emailMessageId: emailMessage.id,
      providerMessageId: null,
      error: message,
    };
  }

  try {
    const result = await resend.emails.send(input.html
      ? {
          from: sendFrom,
          to: recipients,
          subject: input.subject,
          html: input.html,
          ...(input.text ? { text: input.text } : {}),
        }
      : {
          from: sendFrom,
          to: recipients,
          subject: input.subject,
          text: input.text as string,
        }) as {
          data: { id?: string } | null;
          error: { message: string } | null;
        };
    const providerMessageId = result.data?.id ?? null;

    if (result.error) {
      const message = result.error.message;
      await admin
        .from("email_messages")
        .update({
          status: "error",
          provider_message_id: providerMessageId,
          payload: emailPayload(input, idempotencyKey, { error: message, failureStage: "provider" }),
        })
        .eq("id", emailMessage.id);
      await logAuditEvent({
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        eventType: "email_send_failed",
        targetType: "email_message",
        targetId: emailMessage.id,
        metadata: {
          subject: input.subject,
          recipientCount: recipients.length,
          error: message,
        },
      });
      return {
        ok: false,
        emailMessageId: emailMessage.id,
        providerMessageId,
        error: message,
      };
    }

    await admin
      .from("email_messages")
      .update({
        status: "sent",
        provider_message_id: providerMessageId,
        payload: emailPayload(input, idempotencyKey),
      })
      .eq("id", emailMessage.id);
    await logAuditEvent({
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      eventType: "email_sent",
      targetType: "email_message",
      targetId: emailMessage.id,
      metadata: {
        subject: input.subject,
        recipientCount: recipients.length,
      },
    });
    return {
      ok: true,
      emailMessageId: emailMessage.id,
      providerMessageId,
      error: null,
    };
  } catch (error) {
    const message = serializeError(error);
    await admin
      .from("email_messages")
      .update({
        status: "error",
        payload: emailPayload(input, idempotencyKey, { error: message, failureStage: "send" }),
      })
      .eq("id", emailMessage.id);
    await logAuditEvent({
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      eventType: "email_send_failed",
      targetType: "email_message",
      targetId: emailMessage.id,
      metadata: {
        subject: input.subject,
        recipientCount: recipients.length,
        error: message,
      },
    });
    return {
      ok: false,
      emailMessageId: emailMessage.id,
      providerMessageId: null,
      error: message,
    };
  }
}
