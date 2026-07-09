import { describe, it, expect } from "vitest";
import { contextPercent, formatContext, formatCost, formatTokens } from "./usage";

describe("formatTokens", () => {
  it("shows small counts verbatim", () => {
    expect(formatTokens(0)).toBe("0");
    expect(formatTokens(850)).toBe("850");
  });
  it("uses k with one decimal under 100k, rounded at/above 100k", () => {
    expect(formatTokens(12300)).toBe("12.3k");
    expect(formatTokens(200000)).toBe("200k");
  });
});

describe("contextPercent", () => {
  it("computes a rounded percentage", () => {
    expect(contextPercent({ used: 12000, size: 200000 })).toBe(6);
  });
  it("is 0 when the window size is unknown", () => {
    expect(contextPercent({ used: 5, size: 0 })).toBe(0);
  });
});

describe("formatContext", () => {
  it("combines used, size, and percent", () => {
    expect(formatContext({ used: 12300, size: 200000 })).toBe("12.3k / 200k (6%)");
  });
});

describe("formatCost", () => {
  it("returns null when no cost is reported", () => {
    expect(formatCost(null)).toBeNull();
    expect(formatCost(undefined)).toBeNull();
  });
  it("shows USD with a dollar sign; 4 digits under $1, else 2", () => {
    expect(formatCost({ amount: 0.0421, currency: "USD" })).toBe("$0.0421");
    expect(formatCost({ amount: 1.2, currency: "USD" })).toBe("$1.20");
  });
  it("prefixes non-USD currencies with the code", () => {
    expect(formatCost({ amount: 2, currency: "EUR" })).toBe("EUR 2.00");
  });
});
