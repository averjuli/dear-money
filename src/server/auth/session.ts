// Signed session cookie: base64url(JSON payload) + "." + base64url(HMAC-SHA256).
// Uses Web Crypto only, so it works both in proxy.ts and in server code.

export const SESSION_COOKIE = "dm_session";
export const SESSION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface Session {
  userId: string;
}

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  const padded = text.replace(/-/g, "+").replace(/_/g, "/");
  try {
    const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

function hmacKey(secret: string, usage: KeyUsage): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage],
  );
}

export async function signSession(
  session: Session,
  secret: string,
  now = Date.now(),
): Promise<string> {
  const payload = toBase64Url(
    encoder.encode(
      JSON.stringify({
        userId: session.userId,
        exp: now + SESSION_DAYS * DAY_MS,
      }),
    ),
  );
  const key = await hmacKey(secret, "sign");
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload),
  );
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifySession(
  token: string,
  secret: string,
  now = Date.now(),
): Promise<Session | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  const signatureBytes = fromBase64Url(signature);
  const payloadBytes = fromBase64Url(payload);
  if (!signatureBytes || !payloadBytes || signatureBytes.length === 0)
    return null;

  const key = await hmacKey(secret, "verify");
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes,
    encoder.encode(payload),
  );
  if (!valid) return null;

  try {
    const data = JSON.parse(new TextDecoder().decode(payloadBytes)) as {
      userId?: unknown;
      exp?: unknown;
    };
    if (typeof data.userId !== "string" || typeof data.exp !== "number")
      return null;
    if (data.exp <= now) return null;
    return { userId: data.userId };
  } catch {
    return null;
  }
}

export const sessionMaxAgeSeconds = SESSION_DAYS * 24 * 60 * 60;
