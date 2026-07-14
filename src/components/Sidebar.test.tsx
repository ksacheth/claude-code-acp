import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { SessionState } from "../session/sessions";
import { emptyTranscript, type TranscriptState } from "../session/transcript";
import { Sidebar } from "./Sidebar";

const session = (id: string, title: string, cwd: string, turnActive = false): SessionState => ({
  id,
  cwd,
  title,
  transcript: { ...emptyTranscript, turnActive } as TranscriptState,
});

const sessions = [session("A", "alpha", "/repo/alpha"), session("B", "beta", "/repo/beta", true)];

function renderSidebar() {
  return renderToStaticMarkup(
    <Sidebar
      sessions={sessions}
      activeId="A"
      onSelect={() => {}}
      onNew={() => {}}
      onHistory={() => {}}
      onSettings={() => {}}
      onCollapse={() => {}}
      onDelete={() => {}}
      disabled={false}
    />,
  );
}

describe("Sidebar", () => {
  it("lists each session's title and directory", () => {
    const html = renderSidebar();
    expect(html).toContain("alpha");
    expect(html).toContain("beta");
    expect(html).toContain("/repo/alpha");
    expect(html).toContain("+ New session");
  });

  it("highlights the active session", () => {
    const html = renderSidebar();
    expect(html).toMatch(/session-item active[^\"]*"[^>]*>.*session-title[^>]*>\s*alpha/s);
  });

  it("shows a spinner on a session with an active turn", () => {
    expect(renderSidebar()).toContain("session-spinner");
  });

  it("provides a control to collapse the sidebar", () => {
    expect(renderSidebar()).toContain('aria-label="Hide sidebar"');
  });

  it("provides a delete action for each open session", () => {
    const html = renderSidebar();
    expect(html).toContain('aria-label="Delete alpha"');
    expect(html).toContain('aria-label="Delete beta"');
  });
});
