import { describe, it, expect } from "vitest";
import type { AvailableCommand } from "@agentclientprotocol/sdk";

import { matchCommands, commandInsertText, paletteKeyFor, nextHighlight } from "./commands";

const commands: AvailableCommand[] = [
  { name: "compact", description: "Compact the context" },
  { name: "clear", description: "Clear the conversation" },
  { name: "model", description: "Pick a model" },
];

describe("matchCommands", () => {
  it("lists every command for a bare slash", () => {
    expect(matchCommands(commands, "/").map((c) => c.name)).toEqual(["compact", "clear", "model"]);
  });

  it("filters by prefix, case-insensitively", () => {
    expect(matchCommands(commands, "/C").map((c) => c.name)).toEqual(["compact", "clear"]);
    expect(matchCommands(commands, "/mod").map((c) => c.name)).toEqual(["model"]);
  });

  it("returns nothing without a leading slash", () => {
    expect(matchCommands(commands, "hello")).toEqual([]);
  });

  it("stops suggesting once the command name is committed (a space typed)", () => {
    expect(matchCommands(commands, "/compact now")).toEqual([]);
  });

  it("tolerates missing commands and no match", () => {
    expect(matchCommands(undefined, "/x")).toEqual([]);
    expect(matchCommands(commands, "/zzz")).toEqual([]);
  });
});

describe("commandInsertText", () => {
  it("produces /name with a trailing space", () => {
    expect(commandInsertText(commands[0])).toBe("/compact ");
  });
});

describe("paletteKeyFor", () => {
  it("maps navigation keys and ignores others", () => {
    expect(paletteKeyFor("ArrowDown")).toBe("down");
    expect(paletteKeyFor("ArrowUp")).toBe("up");
    expect(paletteKeyFor("Enter")).toBe("accept");
    expect(paletteKeyFor("Tab")).toBe("accept");
    expect(paletteKeyFor("Escape")).toBe("dismiss");
    expect(paletteKeyFor("a")).toBeNull();
  });
});

describe("nextHighlight", () => {
  it("wraps around the entry count", () => {
    expect(nextHighlight(0, 1, 3)).toBe(1);
    expect(nextHighlight(2, 1, 3)).toBe(0);
    expect(nextHighlight(0, -1, 3)).toBe(2);
    expect(nextHighlight(0, 1, 0)).toBe(0);
  });
});
