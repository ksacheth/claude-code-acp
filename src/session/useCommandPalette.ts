import { useCallback, useMemo, useState, type KeyboardEvent } from "react";
import type { AvailableCommand } from "@agentclientprotocol/sdk";

import { commandInsertText, matchCommands, nextHighlight, paletteKeyFor } from "./commands";

export interface CommandPaletteState {
  /// The current composer draft.
  draft: string;
  /// Replace the draft (also resets the highlight and un-dismisses the palette).
  setDraft: (text: string) => void;
  /// Commands matching the draft's `/prefix`.
  matches: AvailableCommand[];
  /// Index of the highlighted match.
  active: number;
  /// Whether the palette should be shown.
  paletteOpen: boolean;
  /// Choose a command — fills the draft with `/name `.
  pick: (command: AvailableCommand) => void;
  /// Palette-aware keydown: navigates/accepts/dismisses while open, else no-op.
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
}

/// The `/` command-palette state machine for the composer: draft, filtering,
/// highlight navigation, and dismissal. Separated from the composer so the
/// composer stays a thin form and this logic is independently reasoned about.
export function useCommandPalette(commands?: AvailableCommand[]): CommandPaletteState {
  const [draft, setDraftRaw] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const matches = useMemo(() => matchCommands(commands, draft), [commands, draft]);
  const paletteOpen = matches.length > 0 && !dismissed;
  const active = Math.min(highlight, matches.length - 1);

  const setDraft = useCallback((text: string) => {
    setDraftRaw(text);
    setHighlight(0);
    setDismissed(false);
  }, []);

  const pick = useCallback((command: AvailableCommand) => setDraft(commandInsertText(command)), [setDraft]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (!paletteOpen) return;
      const action = paletteKeyFor(e.key);
      if (!action) return;
      // Keyboard focus stays on the input, so accepting never needs a refocus.
      e.preventDefault();
      if (action === "accept") pick(matches[active]);
      else if (action === "dismiss") setDismissed(true);
      else setHighlight((h) => nextHighlight(h, action === "down" ? 1 : -1, matches.length));
    },
    [paletteOpen, matches, active, pick],
  );

  return { draft, setDraft, matches, active, paletteOpen, pick, onKeyDown };
}
