import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveTheme } from "./theme";

/// Stub matchMedia so "auto" resolution is deterministic.
function stubSystemDark(dark: boolean) {
  vi.stubGlobal("window", {
    matchMedia: (query: string) => ({
      matches: dark,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("resolveTheme", () => {
  it("returns an explicit mode unchanged, ignoring the system", () => {
    stubSystemDark(true);
    expect(resolveTheme("light")).toBe("light");
    expect(resolveTheme("dark")).toBe("dark");
  });

  it("follows the OS when auto", () => {
    stubSystemDark(true);
    expect(resolveTheme("auto")).toBe("dark");
    stubSystemDark(false);
    expect(resolveTheme("auto")).toBe("light");
  });
});
