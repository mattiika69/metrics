import "server-only";

import { timingSafeEqual } from "node:crypto";

export function timingSafeEqualString(
  received: string | null | undefined,
  expected: string | null | undefined,
) {
  if (!received || !expected) return false;

  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);

  if (receivedBuffer.length !== expectedBuffer.length) return false;

  return timingSafeEqual(receivedBuffer, expectedBuffer);
}
