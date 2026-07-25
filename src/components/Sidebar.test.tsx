import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { buildSidebarTree, type ChatEntry, type SidebarTree } from "../session/projects";
import { emptyTranscript } from "../session/transcript";
import { Sidebar, type SidebarProps } from "./Sidebar";

const NOW = Date.parse("2026-07-25T12:00:00Z");

const tree = buildSidebarTree({
  persisted: [
    {
      sessionId: "A",
      cwd: "/repo/alpha",
      title: "fix the parser",
      updatedAt: "2026-07-25T11:00:00Z",
    },
    {
      sessionId: "B",
      cwd: "/repo/alpha",
      title: "ship the release",
      updatedAt: "2026-07-24T11:00:00Z",
    },
    {
      sessionId: "C",
      cwd: "/repo/beta",
      title: "unrelated work",
      updatedAt: "2026-07-23T11:00:00Z",
    },
    {
      sessionId: "D",
      cwd: "/data/chats",
      title: "just chatting",
      updatedAt: "2026-07-25T10:00:00Z",
    },
  ],
  open: [
    {
      id: "A",
      cwd: "/repo/alpha",
      title: "fix the parser",
      titleSource: "engine",
      transcript: { ...emptyTranscript, turnActive: true },
    },
  ],
  aliases: {},
  chatsDir: "/data/chats",
  unlistedDirs: [],
});

function render(overrides: Partial<SidebarProps> = {}) {
  const props: SidebarProps = {
    tree,
    loading: false,
    activeId: "A",
    expanded: new Set(["/repo/alpha"]),
    nowMs: NOW,
    disabled: false,
    onToggleProject: () => {},
    onRenameProject: () => {},
    onSelectChat: () => {},
    onRenameChat: () => {},
    onDeleteChat: () => {},
    onNewChat: () => {},
    onNewProject: () => {},
    onSettings: () => {},
    onCollapse: () => {},
    ...overrides,
  };
  return renderToStaticMarkup(<Sidebar {...props} />);
}

describe("Sidebar", () => {
  it("groups chats under their project folder", () => {
    const html = render();
    expect(html).toContain("Projects");
    expect(html).toContain("alpha");
    expect(html).toContain("beta");
    expect(html).toContain("fix the parser");
  });

  it("lists project-less chats flat, above the projects", () => {
    const html = render();
    expect(html).toContain("just chatting");
    expect(html.indexOf(">Chats<")).toBeLessThan(html.indexOf(">Projects<"));
    // The chats folder is never shown as a project.
    expect(html).not.toContain(">chats<");
  });

  it("shows chats of an expanded project and hides a collapsed one's", () => {
    expect(render()).toContain("ship the release");
    expect(render({ expanded: new Set() })).not.toContain("ship the release");
  });

  it("reports how many chats each project holds", () => {
    const html = render();
    expect(html).toMatch(/project-count[^>]*>2</);
    expect(html).toMatch(/project-count[^>]*>1</);
  });

  it("marks the active chat and shows a dot while its turn streams", () => {
    const html = render();
    expect(html).toMatch(/chat-item active/);
    expect(html).toContain("session-spinner");
  });

  it("shows a relative time on chats that are not streaming", () => {
    const html = render();
    expect(html).toContain("1d ago");
  });

  it("offers rename and delete on every chat, and rename on every project", () => {
    const html = render();
    expect(html).toContain('aria-label="Options for fix the parser"');
    expect(html).toContain('aria-label="Options for alpha"');
    expect(html).toContain("Rename");
    expect(html).toContain("Delete");
    expect(html).toContain("Reset name");
  });

  it("offers a chat with no project and a chat in a project folder", () => {
    const html = render();
    expect(html).toContain("+ New chat");
    expect(html).toContain('aria-label="New chat in a project folder"');
  });

  it("provides a search field and a control to collapse the sidebar", () => {
    const html = render();
    expect(html).toContain('aria-label="Search chats"');
    expect(html).toContain('aria-label="Hide sidebar"');
  });

  it("tells an empty list apart from one still loading", () => {
    const empty: SidebarTree = { loose: [], projects: [] };
    expect(render({ tree: empty, loading: true })).toContain("Loading chats…");
    expect(render({ tree: empty, loading: false })).toContain(
      "Start a chat and it will appear here.",
    );
  });

  it("disables starting a chat while disconnected", () => {
    expect(render({ disabled: true })).toMatch(/new-session[^>]*disabled/);
  });
});

describe("Sidebar chat titles", () => {
  it("falls back to the folder name when a chat has no title", () => {
    const untitled = buildSidebarTree({
      persisted: [{ sessionId: "X", cwd: "/repo/gamma" }],
      open: [],
      aliases: {},
      unlistedDirs: [],
    });
    const html = render({ tree: untitled, expanded: new Set(["/repo/gamma"]), activeId: "X" });
    // Both the project row and the chat row show the folder name.
    expect(html.match(/gamma/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("uses a project alias for the folder row", () => {
    const aliased = buildSidebarTree({
      persisted: [{ sessionId: "X", cwd: "/repo/gamma", title: "a chat" }],
      open: [],
      aliases: { "/repo/gamma": "Gamma Rays" },
      unlistedDirs: [],
    });
    const html = render({ tree: aliased });
    expect(html).toContain("Gamma Rays");
    expect(html).toContain('aria-label="Options for Gamma Rays"');
  });
});

describe("Sidebar chat rows", () => {
  const chats = (html: string) => html.match(/class="chat-title"[^>]*>([^<]*)</g) ?? [];

  it("orders chats newest first within a project", () => {
    const html = render();
    const titles = chats(html).join("|");
    expect(titles.indexOf("fix the parser")).toBeLessThan(titles.indexOf("ship the release"));
  });

  it("renders a chat entry's title verbatim", () => {
    const entry: ChatEntry = {
      id: "Z",
      cwd: "/repo/alpha",
      title: "a <script> title",
      open: false,
      streaming: false,
    };
    const html = render({ tree: { loose: [entry], projects: [] } });
    expect(html).toContain("a &lt;script&gt; title");
  });
});
