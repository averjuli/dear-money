import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("verifies the right password and rejects a wrong one", async () => {
    const hash = await hashPassword("correct horse");
    expect(hash).toMatch(/^scrypt:[0-9a-f]+:[0-9a-f]+$/);
    expect(await verifyPassword("correct horse", hash)).toBe(true);
    expect(await verifyPassword("wrong horse", hash)).toBe(false);
  });

  it("produces a different salt every time", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });

  it("does not use $ so Next.js env expansion cannot break it", async () => {
    expect(await hashPassword("x")).not.toContain("$");
  });

  it("rejects malformed hashes instead of throwing", async () => {
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "scrypt:zz")).toBe(false);
    expect(await verifyPassword("x", "bcrypt:aa:bb")).toBe(false);
  });
});
