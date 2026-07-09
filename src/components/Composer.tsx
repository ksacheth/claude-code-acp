import { type FormEvent } from "react";
import type { AvailableCommand } from "@agentclientprotocol/sdk";

import { useCommandPalette } from "../session/useCommandPalette";
import { CommandPalette } from "./CommandPalette";

interface ComposerProps {
  cwd: string;
  disabled: boolean;
  canSend: boolean;
  busy: boolean;
  /// Agent slash commands, used to power the `/` autocomplete palette.
  commands?: AvailableCommand[];
  onSend: (text: string) => void;
  onCancel: () => void;
}

/// The prompt input row, showing the session's working directory. While a turn
/// is streaming, the Send button becomes a Cancel button. Typing `/` opens an
/// autocomplete palette of the agent's commands (↑/↓ to move, Enter/Tab to
/// accept, Esc to dismiss); a chosen command is sent as ordinary prompt text.
export function Composer({ cwd, disabled, canSend, busy, commands, onSend, onCancel }: ComposerProps) {
  const { draft, setDraft, matches, active, paletteOpen, pick, onKeyDown } = useCommandPalette(commands);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = draft;
    setDraft("");
    onSend(text);
  };

  return (
    <form className="composer" onSubmit={submit}>
      <div className="cwd" title={cwd}>
        {cwd}
      </div>
      {paletteOpen && <CommandPalette matches={matches} active={active} onPick={pick} />}
      <div className="composer-row">
        <input
          value={draft}
          onChange={(e) => setDraft(e.currentTarget.value)}
          onKeyDown={onKeyDown}
          placeholder="Send a message…  (/ for commands)"
          disabled={disabled}
        />
        {busy ? (
          <button type="button" className="cancel" onClick={onCancel}>
            Cancel
          </button>
        ) : (
          <button type="submit" disabled={!canSend || draft.trim().length === 0}>
            Send
          </button>
        )}
      </div>
    </form>
  );
}
