import { useState, type FormEvent } from "react";

interface ComposerProps {
  cwd: string;
  disabled: boolean;
  canSend: boolean;
  busy: boolean;
  onSend: (text: string) => void;
  onCancel: () => void;
}

/// The prompt input row, showing the session's working directory. While a turn
/// is streaming, the Send button becomes a Cancel button.
export function Composer({ cwd, disabled, canSend, busy, onSend, onCancel }: ComposerProps) {
  const [draft, setDraft] = useState("");

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
      <div className="composer-row">
        <input
          value={draft}
          onChange={(e) => setDraft(e.currentTarget.value)}
          placeholder="Send a message…"
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
