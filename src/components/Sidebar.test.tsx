import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { Sidebar } from "./Sidebar";
import { emptyTranscript, type TranscriptState } from "../session/transcript";
import type { SessionState } from "../session/sessions";

const session = (id: string, title: string, cwd: string, turnActive = false): SessionState => ({
  id,
  cwd,
  title,
  transcript: { ...emptyTranscript, turnActive } as TranscriptState,
});

const sessions = [
  session("A", "alpha", "/repo/alpha"),
  session("B", "beta", "/repo/beta", true),
];

describe("Sidebar", () => {
  it("lists each session's title and directory", () => {
    const html = renderToStaticMarkup(
      <Sidebar sessions={sessions} activeId="A" onSelect={() => {}} onNew={() => {}} onHistory={() => {}} disabled={false} />,
    );
    expect(html).toContain("alpha");
    expect(html).toContain("beta");
    expect(html).toContain("/repo/alpha");
    expect(html).toContain("+ New session");
  });

  it("highlights the active session", () => {
    const html = renderToStaticMarkup(
      <Sidebar sessions={sessions} activeId="A" onSelect={() => {}} onNew={() => {}} onHistory={() => {}} disabled={false} />,
    );
    // The active item carries the "active" class.
    expect(html).toMatch(/session-item active[^"]*"[^>]*>[^<]*<div class="session-title">\s*alpha/);
  });

  it("shows a spinner on a session with an active turn", () => {
    const html = renderToStaticMarkup(
      <Sidebar sessions={sessions} activeId="A" onSelect={() => {}} onNew={() => {}} onHistory={() => {}} disabled={false} />,
    );
    expect(html).toContain("session-spinner");
  });
});
