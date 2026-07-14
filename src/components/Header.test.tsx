import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Header } from "./Header";

describe("Header", () => {
  it("keeps session config selectors out of the header", () => {
    const html = renderToStaticMarkup(
      <Header status="connected" sidebarOpen onToggleSidebar={() => {}} />,
    );
    expect(html).not.toContain("config-select");
  });

  it("shows Claude subscription usage limits without placing context in the header", () => {
    const html = renderToStaticMarkup(
      <Header
        status="connected"
        rateLimits={[{ status: "allowed", type: "five_hour", utilization: 42 }]}
        sidebarOpen
        onToggleSidebar={() => {}}
      />,
    );
    expect(html).toContain("5h limit: 42% used");
    expect(html).not.toContain("12.0k / 200k (6%)");
  });

  it("shows a reopen control when the sidebar is hidden", () => {
    const html = renderToStaticMarkup(
      <Header status="connected" sidebarOpen={false} onToggleSidebar={() => {}} />,
    );
    expect(html).toContain('aria-label="Show sidebar"');
  });
});
