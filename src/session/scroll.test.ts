import { describe, it, expect } from "vitest";

import { isNearBottom } from "./scroll";

describe("isNearBottom", () => {
  it("is true when scrolled all the way down", () => {
    expect(isNearBottom({ scrollTop: 900, scrollHeight: 1000, clientHeight: 100 })).toBe(true);
  });

  it("is true within the threshold slack", () => {
    expect(isNearBottom({ scrollTop: 849, scrollHeight: 1000, clientHeight: 100 }, 50)).toBe(false);
    expect(isNearBottom({ scrollTop: 850, scrollHeight: 1000, clientHeight: 100 }, 50)).toBe(true);
  });

  it("is true when content doesn't overflow the container", () => {
    expect(isNearBottom({ scrollTop: 0, scrollHeight: 100, clientHeight: 200 })).toBe(true);
  });

  it("is false when scrolled well above the bottom", () => {
    expect(isNearBottom({ scrollTop: 0, scrollHeight: 1000, clientHeight: 100 })).toBe(false);
  });
});
