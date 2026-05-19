import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

type EncryptedSecretJson = {
  algorithm: "aes-256-gcm";
  iv: string;
  tag: string;
  ciphertext: string;
};

function getSecretKey() {
  const secret = process.env.INTEGRATION_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret) {
    throw new Error("Missing INTEGRATION_SECRET_KEY.");
  }

  return createHash("sha256").update(secret).digest();
}

export function encryptSecretJson(value: unknown) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getSecretKey(), iv);
  const plaintext = JSON.stringify(value);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  } satisfies EncryptedSecretJson;
}

export function decryptSecretJson<T>(payload: {
  iv: string;
  tag: string;
  ciphertext: string;
}) {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getSecretKey(),
    Buffer.from(payload.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");

  return JSON.parse(plaintext) as T;
}

export function isEncryptedSecretJson(value: unknown): value is EncryptedSecretJson {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const payload = value as Record<string, unknown>;
  return payload.algorithm === "aes-256-gcm" &&
    typeof payload.iv === "string" &&
    typeof payload.tag === "string" &&
    typeof payload.ciphertext === "string";
}
