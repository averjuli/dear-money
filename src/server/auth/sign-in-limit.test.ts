import { describe, expect, it } from "vitest";
import { canSendSignInLink } from "./sign-in-limit";

const at = (hhmmss: string) => new Date(`2026-03-01T${hhmmss}Z`);
const sent = [at("12:00:00"), at("12:03:00"), at("12:05:00")];

describe("canSendSignInLink", () => {
  it("refuses a fourth email within 10 minutes of the first", () => {
    expect(canSendSignInLink(sent, at("12:06:00"))).toBe(false);
    expect(canSendSignInLink(sent, at("12:09:59"))).toBe(false);
  });

  it("allows it once the oldest email is exactly 10 minutes old", () => {
    expect(canSendSignInLink(sent, at("12:10:00"))).toBe(true);
    expect(canSendSignInLink(sent, at("12:10:01"))).toBe(true);
  });

  it("allows it with fewer than three emails in the window", () => {
    expect(
      canSendSignInLink([at("12:00:00"), at("12:03:00")], at("12:04:00")),
    ).toBe(true);
    expect(canSendSignInLink([], at("12:00:00"))).toBe(true);
  });

  it("does not count emails older than 10 minutes", () => {
    expect(
      canSendSignInLink(
        [at("11:00:00"), at("11:30:00"), at("12:05:00"), at("12:06:00")],
        at("12:07:00"),
      ),
    ).toBe(true);
  });
});
