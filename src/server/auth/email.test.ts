import { describe, expect, it } from "vitest";
import { isValidEmail, normalizeEmail } from "./email";

describe("normalizeEmail", () => {
  it("trims spaces and lowercases", () => {
    expect(normalizeEmail(" Anna@Example.COM ")).toBe("anna@example.com");
  });
});

describe("isValidEmail", () => {
  it("accepts ordinary addresses", () => {
    expect(isValidEmail("anna@example.com")).toBe(true);
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("anna.k+tag@mail.example.co.uk")).toBe(true);
  });

  it("accepts a padded, mixed-case address once normalized", () => {
    expect(isValidEmail(normalizeEmail(" Anna@Example.COM "))).toBe(true);
  });

  it("rejects addresses without a proper local part, @ or domain", () => {
    expect(isValidEmail("anna")).toBe(false);
    expect(isValidEmail("anna@")).toBe(false);
    expect(isValidEmail("@example.com")).toBe(false);
    expect(isValidEmail("anna@example")).toBe(false);
    expect(isValidEmail("anna example.com")).toBe(false);
    expect(isValidEmail("anna@@example.com")).toBe(false);
    expect(isValidEmail("anna@example.")).toBe(false);
    expect(isValidEmail("anna@.example.com")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });

  it("rejects spaces inside the address", () => {
    expect(isValidEmail("an na@example.com")).toBe(false);
    expect(isValidEmail("anna@exa mple.com")).toBe(false);
  });

  it("rejects addresses longer than 254 characters", () => {
    const long = `${"a".repeat(245)}@example.com`;
    expect(long.length).toBeGreaterThan(254);
    expect(isValidEmail(long)).toBe(false);
    const ok = `${"a".repeat(64)}@${"b".repeat(60)}.com`;
    expect(isValidEmail(ok)).toBe(true);
  });
});
