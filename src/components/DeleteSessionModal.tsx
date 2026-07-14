import type { SessionState } from "../session/sessions";

interface DeleteSessionModalProps {
  session: SessionState;
  deleting: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteSessionModal({
  session,
  deleting,
  error,
  onConfirm,
  onCancel,
}: DeleteSessionModalProps) {
  return (
    <div className="modal-backdrop" onClick={deleting ? undefined : onCancel}>
      <div
        className="modal delete-session-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-session-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-title" id="delete-session-title">
          Delete session?
        </div>
        <p>
          Permanently delete <strong>{session.title}</strong> and its conversation history?
        </p>
        <div className="delete-session-cwd" title={session.cwd}>
          {session.cwd}
        </div>
        {error && <div className="delete-session-error">{error}</div>}
        <div className="modal-options">
          <button type="button" className="secondary" disabled={deleting} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="delete-confirm" disabled={deleting} onClick={onConfirm}>
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
