import { describe, expect, it } from "vitest";
import { menuSection } from "./nav-sections";

describe("menuSection", () => {
  it("shows the menu on the four section screens", () => {
    expect(menuSection("/")).toBe("envelopes");
    expect(menuSection("/daily")).toBe("daily");
    expect(menuSection("/income")).toBe("income");
    expect(menuSection("/settings")).toBe("settings");
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
      expect(menuSection(path)).toBeNull();
    }
  });
});
