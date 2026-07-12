import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { SettingsModal } from "./SettingsModal";
import type { Settings } from "../session/settings";

const settings: Settings = {
  enginePath: "/repo/dist/index.js",
  nodePath: "/usr/local/bin/node",
  env: [{ name: "PATH", value: "/usr/local/bin" }],
  defaultModel: "opus",
  defaultMode: "plan",
  theme: "auto",
  mcpServers: [{ name: "filesystem", command: "npx", args: ["-y", "server"], env: [] }],
};

describe("SettingsModal", () => {
  it("seeds each field from the current settings", () => {
    const html = renderToStaticMarkup(
      <SettingsModal settings={settings} onSave={() => {}} onClose={() => {}} />,
    );
    expect(html).toContain('value="/usr/local/bin/node"');
    expect(html).toContain('value="/repo/dist/index.js"');
    expect(html).toContain('value="opus"');
    // The MCP server row seeds its name and joined args.
    expect(html).toContain('value="filesystem"');
    expect(html).toContain('value="-y server"');
    expect(html).toContain("+ Add MCP server");
  });

  it("renders empty fields for default (unconfigured) settings", () => {
    const html = renderToStaticMarkup(
      <SettingsModal settings={{ env: [], mcpServers: [], theme: "auto" }} onSave={() => {}} onClose={() => {}} />,
    );
    expect(html).toContain("Settings");
    expect(html).not.toContain("mcp-row");
  });

  it("shows the verified Claude account state", () => {
    const html = renderToStaticMarkup(
      <SettingsModal settings={settings} onSave={() => {}} onClose={() => {}} onLogin={() => {}} loggedIn />,
    );
    expect(html).toContain("Signed in with your Claude subscription");
    expect(html).toContain("Log in again");
  });
});
