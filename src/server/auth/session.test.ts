import { describe, expect, it } from "vitest";
import { SESSION_DAYS, signSession, verifySession } from "./session";

const secret = "test-secret-with-enough-length-0123456789";
const now = Date.UTC(2026, 9, 21);

describe("session token", () => {
  it("round-trips the user id", async () => {
    const token = await signSession({ userId: "u1" }, secret, now);
    expect(await verifySession(token, secret, now)).toEqual({ userId: "u1" });
  });

  it("lives 30 days", async () => {
    expect(SESSION_DAYS).toBe(30);
    const token = await signSession({ userId: "u1" }, secret, now);
    const day = 24 * 60 * 60 * 1000;
    expect(await verifySession(token, secret, now + 29 * day)).not.toBeNull();
    expect(await verifySession(token, secret, now + 31 * day)).toBeNull();
  });

  it("rejects a token signed with another secret", async () => {
    const token = await signSession({ userId: "u1" }, secret, now);
    expect(await verifySession(token, `${secret}x`, now)).toBeNull();
  });

  it("rejects a tampered payload", async () => {
    const token = await signSession({ userId: "u1" }, secret, now);
    const [, signature] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ userId: "u2", exp: now + 1e9 }),
    ).toString("base64url");
    expect(
      await verifySession(`${forged}.${signature}`, secret, now),
    ).toBeNull();
  });

  it("rejects garbage", async () => {
    expect(await verifySession("", secret, now)).toBeNull();
    expect(await verifySession("abc", secret, now)).toBeNull();
    expect(await verifySession("a.b.c", secret, now)).toBeNull();
  });
});
