import { createHmac, timingSafeEqual } from "node:crypto";

export function verifySlackSignature({
  body,
  signature,
  timestamp,
  signingSecret,
}: {
  body: string;
  signature: string | null;
  timestamp: string | null;
  signingSecret: string;
}) {
  if (!signature || !timestamp) {
    return false;
  }

  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));

  if (!Number.isFinite(ageSeconds) || ageSeconds > 60 * 5) {
    return false;
  }

  const base = `v0:${timestamp}:${body}`;
  const digest = `v0=${createHmac("sha256", signingSecret)
    .update(base)
    .digest("hex")}`;

  return timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}
