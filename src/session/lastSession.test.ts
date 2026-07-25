import { describe, it, expect } from "vitest";

import { loadLastSession, normalizeLastSession, saveLastSession } from "./lastSession";

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

describe("loadLastSession / saveLastSession", () => {
  it("returns nothing when storage is empty", () => {
    expect(loadLastSession(memoryStorage())).toBeUndefined();
  });

  it("round-trips the active chat", () => {
    const store = memoryStorage();
    saveLastSession({ id: "s1", cwd: "/work/app" }, store);
    expect(loadLastSession(store)).toEqual({ id: "s1", cwd: "/work/app" });
  });

  it("clears the selection when no chat is open", () => {
    const store = memoryStorage();
    saveLastSession({ id: "s1", cwd: "/work/app" }, store);
    saveLastSession(undefined, store);
    expect(loadLastSession(store)).toBeUndefined();
  });

  it("falls back to nothing on corrupt JSON", () => {
    expect(loadLastSession(memoryStorage("{not json"))).toBeUndefined();
  });
});

describe("normalizeLastSession", () => {
  it("requires both an id and a cwd", () => {
    expect(normalizeLastSession({ active: { id: "s1", cwd: "/a" } })).toEqual({
      id: "s1",
      cwd: "/a",
    });
    expect(normalizeLastSession({ active: { id: "s1" } })).toBeUndefined();
    expect(normalizeLastSession({ active: { cwd: "/a" } })).toBeUndefined();
    expect(normalizeLastSession({ active: { id: "", cwd: "/a" } })).toBeUndefined();
  });

  it("tolerates junk", () => {
    expect(normalizeLastSession(null)).toBeUndefined();
    expect(normalizeLastSession({ active: "nope" })).toBeUndefined();
    expect(normalizeLastSession(42)).toBeUndefined();
  });

  describe("migrating the pre-M7 open-session list", () => {
    it("pulls out the entry named by activeId", () => {
      expect(
        normalizeLastSession({
          sessions: [
            { id: "s1", cwd: "/a" },
            { id: "s2", cwd: "/b" },
          ],
          activeId: "s1",
        }),
      ).toEqual({ id: "s1", cwd: "/a" });
    });

    it("falls back to the last entry when activeId is missing or stale", () => {
      const sessions = [
        { id: "s1", cwd: "/a" },
        { id: "s2", cwd: "/b" },
      ];
      expect(normalizeLastSession({ sessions })).toEqual({ id: "s2", cwd: "/b" });
      expect(normalizeLastSession({ sessions, activeId: "gone" })).toEqual({
        id: "s2",
        cwd: "/b",
      });
    });

    it("skips malformed entries, and reports nothing when none survive", () => {
      expect(
        normalizeLastSession({ sessions: [{ id: "s1" }, 7, { id: "s2", cwd: "/b" }] }),
      ).toEqual({ id: "s2", cwd: "/b" });
      expect(normalizeLastSession({ sessions: [{ id: "s1" }, 7] })).toBeUndefined();
      expect(normalizeLastSession({ sessions: [] })).toBeUndefined();
    });

    it("prefers the current shape when both are present", () => {
      expect(
        normalizeLastSession({
          active: { id: "new", cwd: "/new" },
          sessions: [{ id: "old", cwd: "/old" }],
          activeId: "old",
        }),
      ).toEqual({ id: "new", cwd: "/new" });
    });
  });
});
