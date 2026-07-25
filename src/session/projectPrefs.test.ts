import { describe, it, expect } from "vitest";

import {
  emptyProjectPrefs,
  loadProjectPrefs,
  normalizeProjectPrefs,
  saveProjectPrefs,
  withAlias,
  withToggledExpanded,
  withToggledHidden,
} from "./projectPrefs";

function memoryStorage(seed?: string): Storage {
  let value: string | null = seed ?? null;
  return {
    getItem: () => value,
    setItem: (_k: string, v: string) => {
      value = v;
    },
    removeItem: () => {
      value = null;
    },
    clear: () => {
      value = null;
    },
    key: () => null,
    length: 0,
  };
}

describe("loadProjectPrefs / saveProjectPrefs", () => {
  it("returns empty prefs when nothing is stored", () => {
    expect(loadProjectPrefs(memoryStorage())).toEqual(emptyProjectPrefs);
  });

  it("round-trips through storage", () => {
    const store = memoryStorage();
    const prefs = {
      aliases: { "/work/app": "The App" },
      expanded: ["/work/app"],
      hidden: ["/work/junk"],
    };
    saveProjectPrefs(prefs, store);
    expect(loadProjectPrefs(store)).toEqual(prefs);
  });

  it("falls back to empty on corrupt JSON", () => {
    expect(loadProjectPrefs(memoryStorage("{not json"))).toEqual(emptyProjectPrefs);
  });
});

describe("normalizeProjectPrefs", () => {
  it("keeps only string labels and trims them", () => {
    expect(
      normalizeProjectPrefs({
        aliases: { "/a": "  Alpha  ", "/b": 7, "/c": "", "/d": "   " },
      }).aliases,
    ).toEqual({ "/a": "Alpha" });
  });

  it("de-duplicates the expanded list and drops non-strings", () => {
    expect(normalizeProjectPrefs({ expanded: ["/a", "/a", 3, "", "/b"] }).expanded).toEqual([
      "/a",
      "/b",
    ]);
  });

  it("de-duplicates the hidden list and drops non-strings", () => {
    expect(normalizeProjectPrefs({ hidden: ["/a", "/a", 3, "", "/b"] }).hidden).toEqual([
      "/a",
      "/b",
    ]);
  });

  it("tolerates junk in place of any field", () => {
    expect(normalizeProjectPrefs({ aliases: "nope", expanded: 4, hidden: {} })).toEqual(
      emptyProjectPrefs,
    );
    expect(normalizeProjectPrefs({ aliases: ["a"] })).toEqual(emptyProjectPrefs);
    expect(normalizeProjectPrefs(null)).toEqual(emptyProjectPrefs);
  });

  it("defaults hidden to empty for prefs saved before hiding existed", () => {
    expect(normalizeProjectPrefs({ aliases: { "/a": "Alpha" }, expanded: ["/a"] }).hidden).toEqual(
      [],
    );
  });
});

describe("withAlias", () => {
  it("sets a trimmed label", () => {
    expect(withAlias(emptyProjectPrefs, "/a", "  Alpha  ").aliases).toEqual({ "/a": "Alpha" });
  });

  it("clears the label when given a blank one", () => {
    const prefs = { aliases: { "/a": "Alpha" }, expanded: [], hidden: [] };
    expect(withAlias(prefs, "/a", "   ").aliases).toEqual({});
  });

  it("leaves other projects and the rest of the prefs alone", () => {
    const prefs = { aliases: { "/a": "Alpha" }, expanded: ["/b"], hidden: ["/c"] };
    const next = withAlias(prefs, "/b", "Beta");
    expect(next.aliases).toEqual({ "/a": "Alpha", "/b": "Beta" });
    expect(next.expanded).toEqual(["/b"]);
    expect(next.hidden).toEqual(["/c"]);
  });
});

describe("withToggledExpanded", () => {
  it("expands a collapsed project and collapses an expanded one", () => {
    const opened = withToggledExpanded(emptyProjectPrefs, "/a");
    expect(opened.expanded).toEqual(["/a"]);
    expect(withToggledExpanded(opened, "/a").expanded).toEqual([]);
  });

  it("leaves the other prefs untouched", () => {
    const prefs = { aliases: { "/a": "Alpha" }, expanded: [], hidden: ["/c"] };
    const next = withToggledExpanded(prefs, "/a");
    expect(next.aliases).toEqual({ "/a": "Alpha" });
    expect(next.hidden).toEqual(["/c"]);
  });
});

describe("withToggledHidden", () => {
  it("hides a visible project and unhides a hidden one", () => {
    const hidden = withToggledHidden(emptyProjectPrefs, "/a");
    expect(hidden.hidden).toEqual(["/a"]);
    expect(withToggledHidden(hidden, "/a").hidden).toEqual([]);
  });

  it("hides projects independently", () => {
    const both = withToggledHidden(withToggledHidden(emptyProjectPrefs, "/a"), "/b");
    expect(both.hidden).toEqual(["/a", "/b"]);
    expect(withToggledHidden(both, "/a").hidden).toEqual(["/b"]);
  });

  it("leaves the other prefs untouched", () => {
    const prefs = { aliases: { "/a": "Alpha" }, expanded: ["/a"], hidden: [] };
    const next = withToggledHidden(prefs, "/a");
    expect(next.aliases).toEqual({ "/a": "Alpha" });
    expect(next.expanded).toEqual(["/a"]);
  });
});
