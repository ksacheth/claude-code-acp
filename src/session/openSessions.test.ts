import { describe, it, expect } from "vitest";

import {
  emptyOpenSessions,
  loadOpenSessions,
  normalizeOpenSessions,
  saveOpenSessions,
  type OpenSessionsSnapshot,
} from "./openSessions";

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

describe("loadOpenSessions / saveOpenSessions", () => {
  it("returns an empty snapshot when nothing is stored", () => {
    expect(loadOpenSessions(memoryStorage())).toEqual(emptyOpenSessions);
  });

  it("round-trips through storage", () => {
    const store = memoryStorage();
    const snapshot: OpenSessionsSnapshot = {
      sessions: [
        { id: "s1", cwd: "/a" },
        { id: "s2", cwd: "/b" },
      ],
      activeId: "s2",
    };
    saveOpenSessions(snapshot, store);
    expect(loadOpenSessions(store)).toEqual(snapshot);
  });

  it("falls back to empty on corrupt JSON", () => {
    expect(loadOpenSessions(memoryStorage("{not json"))).toEqual(emptyOpenSessions);
  });
});

describe("normalizeOpenSessions", () => {
  it("drops entries missing an id or cwd", () => {
    const snap = normalizeOpenSessions({
      sessions: [{ id: "s1", cwd: "/a" }, { id: "s2" }, { cwd: "/c" }, 42],
    });
    expect(snap.sessions).toEqual([{ id: "s1", cwd: "/a" }]);
  });

  it("keeps activeId only when it names a surviving session", () => {
    const kept = normalizeOpenSessions({ sessions: [{ id: "s1", cwd: "/a" }], activeId: "s1" });
    expect(kept.activeId).toBe("s1");
    const dropped = normalizeOpenSessions({ sessions: [{ id: "s1", cwd: "/a" }], activeId: "gone" });
    expect(dropped.activeId).toBeUndefined();
  });

  it("tolerates a non-array sessions field", () => {
    expect(normalizeOpenSessions({ sessions: "nope" })).toEqual(emptyOpenSessions);
    expect(normalizeOpenSessions(null)).toEqual(emptyOpenSessions);
  });
});
