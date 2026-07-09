import { describe, it, expect } from "vitest";
import { cancelledOutcome, isAllow, selectedOutcome } from "./permission";

describe("permission outcomes", () => {
  it("builds a selected outcome carrying the option id", () => {
    expect(selectedOutcome("opt-1")).toEqual({
      outcome: { outcome: "selected", optionId: "opt-1" },
    });
  });

  it("builds a cancelled outcome", () => {
    expect(cancelledOutcome()).toEqual({ outcome: { outcome: "cancelled" } });
  });

  it("classifies allow vs reject option kinds", () => {
    expect(isAllow("allow_once")).toBe(true);
    expect(isAllow("allow_always")).toBe(true);
    expect(isAllow("reject_once")).toBe(false);
    expect(isAllow("reject_always")).toBe(false);
  });
});
