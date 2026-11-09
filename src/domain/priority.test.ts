import { describe, expect, it } from "vitest";
import { moveItem } from "./priority";

describe("moveItem", () => {
  it("dragging «Маникюр» from 4th to 1st shifts the rest down without gaps", () => {
    const order = [
      "Здоровье",
      "Косметология",
      "Стоматолог",
      "Маникюр",
      "Стрижка",
    ];
    expect(moveItem(order, 3, 0)).toEqual([
      "Маникюр",
      "Здоровье",
      "Косметология",
      "Стоматолог",
      "Стрижка",
    ]);
  });

  it("moves down as well", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
  });

  it("ignores out-of-range indexes", () => {
    expect(moveItem(["a", "b"], 5, 0)).toEqual(["a", "b"]);
  });
});
