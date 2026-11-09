import { describe, expect, it } from "vitest";
import { phoneMenuSection } from "./nav-sections";

describe("phoneMenuSection", () => {
  it("shows the menu on the four section screens", () => {
    expect(phoneMenuSection("/")).toBe("envelopes");
    expect(phoneMenuSection("/daily")).toBe("daily");
    expect(phoneMenuSection("/income")).toBe("income");
    expect(phoneMenuSection("/settings")).toBe("settings");
  });

  it("hides the menu on the other screens", () => {
    for (const path of [
      "/wallets",
      "/wallets/w1",
      "/daily/categories/1",
      "/expenses/new",
      "/install",
      "/login",
    ]) {
      expect(phoneMenuSection(path)).toBeNull();
    }
  });
});
