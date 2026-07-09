import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { AvailableCommand } from "@agentclientprotocol/sdk";

import { CommandPalette } from "./CommandPalette";

const matches: AvailableCommand[] = [
  { name: "compact", description: "Compact the context" },
  { name: "clear", description: "Clear the conversation" },
];

describe("CommandPalette", () => {
  it("lists each command's name and description", () => {
    const html = renderToStaticMarkup(<CommandPalette matches={matches} active={0} onPick={() => {}} />);
    expect(html).toContain("/compact");
    expect(html).toContain("Compact the context");
    expect(html).toContain("/clear");
  });

  it("marks the active entry as selected", () => {
    const html = renderToStaticMarkup(<CommandPalette matches={matches} active={1} onPick={() => {}} />);
    // Attributes render in JSX source order: role, aria-selected, class.
    expect(html).toMatch(/aria-selected="true" class="command-item active">.*?\/clear/);
    expect(html).toMatch(/aria-selected="false" class="command-item">.*?\/compact/);
  });
});
