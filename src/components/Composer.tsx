import { useState, type FormEvent } from "react";

interface ComposerProps {
  cwd: string;
  disabled: boolean;
  canSend: boolean;
  busy: boolean;
  onSend: (text: string) => void;
}

/// The prompt input row, showing the session's working directory.
export function Composer({ cwd, disabled, canSend, busy, onSend }: ComposerProps) {
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
        <button type="submit" disabled={!canSend || draft.trim().length === 0}>
          {busy ? "…" : "Send"}
        </button>
      </div>
    </form>
  );
}
