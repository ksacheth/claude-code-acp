import { describe, it, expect } from "vitest";
import type { SessionInfo } from "@agentclientprotocol/sdk";

import {
  allChats,
  buildSidebarTree,
  expandedWithActive,
  filterTree,
  normalizeDir,
  renamedTitle,
  type TreeInput,
} from "./projects";
import { emptyTranscript } from "./transcript";
import type { SessionState } from "./sessions";

function persisted(id: string, cwd: string, title?: string, updatedAt?: string): SessionInfo {
  return { sessionId: id, cwd, ...(title ? { title } : {}), ...(updatedAt ? { updatedAt } : {}) };
}

function open(id: string, cwd: string, overrides: Partial<SessionState> = {}): SessionState {
  return {
    id,
    cwd,
    title: cwd.split("/").filter(Boolean).pop() ?? cwd,
    titleSource: "cwd",
    transcript: emptyTranscript,
    ...overrides,
  };
}

function input(overrides: Partial<TreeInput> = {}): TreeInput {
  return { persisted: [], open: [], aliases: {}, unlistedDirs: [], ...overrides };
}

describe("normalizeDir", () => {
  it("strips trailing slashes and surrounding space", () => {
    expect(normalizeDir("/a/b/")).toBe("/a/b");
    expect(normalizeDir("  /a/b  ")).toBe("/a/b");
    expect(normalizeDir("/a/b///")).toBe("/a/b");
  });

  it("leaves the root and a bare path alone", () => {
    expect(normalizeDir("/")).toBe("/");
    expect(normalizeDir("/a/b")).toBe("/a/b");
  });
});

describe("buildSidebarTree grouping", () => {
  it("groups chats under their project directory", () => {
    const tree = buildSidebarTree(
      input({
        persisted: [
          persisted("s1", "/work/app", "One", "2026-07-01T00:00:00Z"),
          persisted("s2", "/work/app", "Two", "2026-07-02T00:00:00Z"),
          persisted("s3", "/work/other", "Three", "2026-07-03T00:00:00Z"),
        ],
      }),
    );

    expect(tree.projects.map((p) => p.cwd)).toEqual(["/work/other", "/work/app"]);
    expect(tree.projects[1].chats.map((c) => c.title)).toEqual(["Two", "One"]);
    expect(tree.loose).toEqual([]);
  });

  it("labels a project with its basename, or the alias when set", () => {
    const tree = buildSidebarTree(
      input({
        persisted: [persisted("s1", "/work/claude-agent-acp")],
        aliases: { "/work/other": "  Renamed  " },
      }),
    );
    expect(tree.projects[0].label).toBe("claude-agent-acp");

    const aliased = buildSidebarTree(
      input({
        persisted: [persisted("s1", "/work/other")],
        aliases: { "/work/other": "  Renamed  " },
      }),
    );
    expect(aliased.projects[0].label).toBe("Renamed");
  });

  it("treats paths that differ only by a trailing slash as one project", () => {
    const tree = buildSidebarTree(
      input({
        persisted: [persisted("s1", "/work/app/"), persisted("s2", "/work/app")],
      }),
    );
    expect(tree.projects).toHaveLength(1);
    expect(tree.projects[0].chats).toHaveLength(2);
  });

  it("tolerates a null persisted list", () => {
    expect(buildSidebarTree(input({ persisted: null }))).toEqual({ loose: [], projects: [] });
  });
});

describe("buildSidebarTree loose chats", () => {
  it("puts chats in the chats directory in the flat section", () => {
    const tree = buildSidebarTree(
      input({
        persisted: [
          persisted("s1", "/data/chats", "Just chatting"),
          persisted("s2", "/work/app", "Real work"),
        ],
        chatsDir: "/data/chats/",
      }),
    );

    expect(tree.loose.map((c) => c.title)).toEqual(["Just chatting"]);
    expect(tree.projects.map((p) => p.cwd)).toEqual(["/work/app"]);
  });

  it("also unlists directories the user marked", () => {
    const tree = buildSidebarTree(
      input({
        persisted: [
          persisted("s1", "/Users/me", "Home poking"),
          persisted("s2", "/Users/me/Downloads", "Downloads"),
          persisted("s3", "/work/app", "Real work"),
        ],
        unlistedDirs: ["/Users/me", "/Users/me/Downloads/"],
      }),
    );

    expect(tree.loose.map((c) => c.title).sort()).toEqual(["Downloads", "Home poking"]);
    expect(tree.projects.map((p) => p.cwd)).toEqual(["/work/app"]);
  });

  it("ignores blank entries in the unlisted list", () => {
    const tree = buildSidebarTree(
      input({ persisted: [persisted("s1", "/work/app")], unlistedDirs: ["", "   "] }),
    );
    expect(tree.loose).toEqual([]);
    expect(tree.projects).toHaveLength(1);
  });
});

describe("buildSidebarTree open sessions", () => {
  it("marks persisted chats that are loaded, carrying the streaming flag", () => {
    const tree = buildSidebarTree(
      input({
        persisted: [persisted("s1", "/work/app", "One"), persisted("s2", "/work/app", "Two")],
        open: [
          open("s1", "/work/app", {
            transcript: { ...emptyTranscript, turnActive: true },
          }),
        ],
      }),
    );

    const chats = tree.projects[0].chats;
    expect(chats.find((c) => c.id === "s1")).toMatchObject({ open: true, streaming: true });
    expect(chats.find((c) => c.id === "s2")).toMatchObject({ open: false, streaming: false });
  });

  it("includes an open chat that is not on disk yet", () => {
    const tree = buildSidebarTree(input({ open: [open("new", "/work/app")] }));
    expect(tree.projects[0].chats).toEqual([
      {
        id: "new",
        cwd: "/work/app",
        title: "app",
        open: true,
        streaming: false,
      },
    ]);
  });

  it("sorts a brand-new open chat above every timestamped one", () => {
    const tree = buildSidebarTree(
      input({
        persisted: [persisted("old", "/work/app", "Old", "2026-07-09T00:00:00Z")],
        open: [open("fresh", "/work/app")],
      }),
    );
    expect(tree.projects[0].chats.map((c) => c.id)).toEqual(["fresh", "old"]);
  });

  it("sorts a persisted chat with no timestamp last", () => {
    const tree = buildSidebarTree(
      input({
        persisted: [
          persisted("undated", "/work/app", "Undated"),
          persisted("dated", "/work/app", "Dated", "2026-01-01T00:00:00Z"),
        ],
      }),
    );
    expect(tree.projects[0].chats.map((c) => c.id)).toEqual(["dated", "undated"]);
  });
});

describe("buildSidebarTree titles", () => {
  it("prefers the persisted title over an open session's basename placeholder", () => {
    const tree = buildSidebarTree(
      input({
        persisted: [persisted("s1", "/work/app", "Fix the flaky test")],
        open: [open("s1", "/work/app")],
      }),
    );
    expect(tree.projects[0].chats[0].title).toBe("Fix the flaky test");
  });

  it("prefers a live engine title over the persisted one", () => {
    const tree = buildSidebarTree(
      input({
        persisted: [persisted("s1", "/work/app", "Stale summary")],
        open: [open("s1", "/work/app", { title: "Renamed just now", titleSource: "engine" })],
      }),
    );
    expect(tree.projects[0].chats[0].title).toBe("Renamed just now");
  });

  it("falls back to the basename when no title exists anywhere", () => {
    const tree = buildSidebarTree(input({ persisted: [persisted("s1", "/work/app")] }));
    expect(tree.projects[0].chats[0].title).toBe("app");
  });

  it("treats a whitespace-only persisted title as absent", () => {
    const tree = buildSidebarTree(
      input({ persisted: [persisted("s1", "/work/app", "   ")], open: [open("s1", "/work/app")] }),
    );
    expect(tree.projects[0].chats[0].title).toBe("app");
  });
});

describe("filterTree", () => {
  const tree = buildSidebarTree(
    input({
      persisted: [
        persisted("s1", "/work/app", "Fix the sidebar"),
        persisted("s2", "/work/app", "Ship the release"),
        persisted("s3", "/work/zint", "Unrelated"),
        persisted("s4", "/data/chats", "Chat about sidebars"),
      ],
      chatsDir: "/data/chats",
    }),
  );

  it("returns the tree untouched for a blank query", () => {
    expect(filterTree(tree, "   ")).toBe(tree);
  });

  it("matches chat titles case-insensitively, dropping emptied groups", () => {
    const filtered = filterTree(tree, "SIDEBAR");
    expect(filtered.projects.map((p) => p.cwd)).toEqual(["/work/app"]);
    expect(filtered.projects[0].chats.map((c) => c.id)).toEqual(["s1"]);
    expect(filtered.loose.map((c) => c.id)).toEqual(["s4"]);
  });

  it("keeps every chat in a project whose label matches", () => {
    const filtered = filterTree(tree, "app");
    expect(filtered.projects[0].chats.map((c) => c.id).sort()).toEqual(["s1", "s2"]);
  });

  it("can filter down to nothing", () => {
    expect(filterTree(tree, "nothing matches this")).toEqual({ loose: [], projects: [] });
  });
});

describe("allChats", () => {
  it("lists loose chats before project chats", () => {
    const tree = buildSidebarTree(
      input({
        persisted: [persisted("s1", "/work/app"), persisted("s2", "/data/chats")],
        chatsDir: "/data/chats",
      }),
    );
    expect(allChats(tree).map((c) => c.id)).toEqual(["s2", "s1"]);
  });
});

describe("renamedTitle", () => {
  it("commits a changed, trimmed title", () => {
    expect(renamedTitle("  New name  ", "Old name")).toBe("New name");
  });

  it("cancels on a blank value", () => {
    expect(renamedTitle("", "Old name")).toBeUndefined();
    expect(renamedTitle("   ", "Old name")).toBeUndefined();
  });

  it("cancels when nothing changed, including after trimming", () => {
    expect(renamedTitle("Old name", "Old name")).toBeUndefined();
    expect(renamedTitle("  Old name  ", "Old name")).toBeUndefined();
  });
});

describe("expandedWithActive", () => {
  const tree = buildSidebarTree(
    input({
      persisted: [persisted("s1", "/work/app"), persisted("s2", "/work/zint")],
    }),
  );

  it("adds the active chat's project so the selection is visible", () => {
    expect([...expandedWithActive([], tree, "s1")]).toEqual(["/work/app"]);
  });

  it("keeps the saved set and normalizes its paths", () => {
    const set = expandedWithActive(["/work/zint/"], tree, "s1");
    expect([...set].sort()).toEqual(["/work/app", "/work/zint"]);
  });

  it("returns just the saved set when nothing is active", () => {
    expect([...expandedWithActive(["/work/zint"], tree, undefined)]).toEqual(["/work/zint"]);
  });

  it("ignores an active id that belongs to no project", () => {
    expect([...expandedWithActive([], tree, "unknown")]).toEqual([]);
  });
});
