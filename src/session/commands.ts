import type { AvailableCommand } from "@agentclientprotocol/sdk";

/// Slash commands matching the current draft: for a draft whose first token is
/// `/prefix` (no whitespace yet), the commands whose name starts with `prefix`
/// (case-insensitive); `[]` otherwise. A bare `/` lists every command; once the
/// user types a space the name is committed, so suggestions stop.
export function matchCommands(
  commands: AvailableCommand[] | undefined,
  draft: string,
): AvailableCommand[] {
  if (!commands || !draft.startsWith("/")) return [];
  const rest = draft.slice(1);
  if (/\s/.test(rest)) return [];
  const prefix = rest.toLowerCase();
  return commands.filter((c) => c.name.toLowerCase().startsWith(prefix));
}

/// The draft text that selecting `command` produces: `/name ` — the trailing
/// space commits the name and readies the cursor for any freeform arguments.
export function commandInsertText(command: AvailableCommand): string {
  return `/${command.name} `;
}

/// The palette navigation intent for a keydown, or null to ignore the key.
export type PaletteKey = "down" | "up" | "accept" | "dismiss";

export function paletteKeyFor(key: string): PaletteKey | null {
  switch (key) {
    case "ArrowDown":
      return "down";
    case "ArrowUp":
      return "up";
    case "Enter":
    case "Tab":
      return "accept";
    case "Escape":
      return "dismiss";
    default:
      return null;
  }
}

/// Move the highlighted index by `delta`, wrapping around `count` entries.
export function nextHighlight(current: number, delta: number, count: number): number {
  if (count <= 0) return 0;
  return (current + delta + count) % count;
}
