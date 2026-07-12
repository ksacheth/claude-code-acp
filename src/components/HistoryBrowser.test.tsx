import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { HistoryBrowser, sortByRecency } from "./HistoryBrowser";
import type { SessionInfo } from "@agentclientprotocol/sdk";

const now = Date.parse("2026-07-09T12:00:00Z");

const sessions: SessionInfo[] = [
  { sessionId: "old", cwd: "/repo/old", title: "Older work", updatedAt: "2026-07-01T12:00:00Z" },
  { sessionId: "new", cwd: "/repo/new", title: "Newer work", updatedAt: "2026-07-09T11:00:00Z" },
];

describe("sortByRecency", () => {
  it("orders sessions most-recently-updated first", () => {
    expect(sortByRecency(sessions).map((s) => s.sessionId)).toEqual(["new", "old"]);
  });
});

describe("HistoryBrowser", () => {
  it("shows a loading state while sessions are null", () => {
    const html = renderToStaticMarkup(
      <HistoryBrowser sessions={null} nowMs={now} onResume={() => {}} onDelete={() => {}} onClose={() => {}} />,
    );
    expect(html).toContain("Loading");
  });

  it("shows an empty state when there are no sessions", () => {
    const html = renderToStaticMarkup(
      <HistoryBrowser sessions={[]} nowMs={now} onResume={() => {}} onDelete={() => {}} onClose={() => {}} />,
    );
    expect(html).toContain("No past sessions");
  });

  it("lists sessions with title, directory, and relative time", () => {
    const html = renderToStaticMarkup(
      <HistoryBrowser sessions={sessions} nowMs={now} onResume={() => {}} onDelete={() => {}} onClose={() => {}} />,
    );
    expect(html).toContain("Newer work");
    expect(html).toContain("/repo/old");
    expect(html).toContain("1h ago");
    expect(html).toContain("Delete");
  });

  it("falls back to the cwd basename when a session has no title", () => {
    const untitled: SessionInfo[] = [{ sessionId: "x", cwd: "/repo/widget", updatedAt: null }];
    const html = renderToStaticMarkup(
      <HistoryBrowser sessions={untitled} nowMs={now} onResume={() => {}} onDelete={() => {}} onClose={() => {}} />,
    );
    expect(html).toContain("widget");
  });
});
