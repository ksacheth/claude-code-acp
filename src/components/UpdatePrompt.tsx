import type { Update } from "@tauri-apps/plugin-updater";

interface UpdatePromptProps {
  update: Update;
  installing: boolean;
  error?: string | null;
  onInstall: () => void;
  onDismiss: () => void;
}

export function UpdatePrompt({
  update,
  installing,
  error,
  onInstall,
  onDismiss,
}: UpdatePromptProps) {
  return (
    <div className="modal-backdrop" onClick={onDismiss}>
      <div className="modal update-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-title">Update available</div>
        <p>
          Claude Tauri {update.version} is ready to install. Your current version is {update.currentVersion}.
        </p>
        {update.body && <div className="update-notes">{update.body}</div>}
        {error && <p className="update-error">{error}</p>}
        <div className="modal-options">
          <button type="button" className="secondary" onClick={onDismiss} disabled={installing}>
            Later
          </button>
          <button type="button" onClick={onInstall} disabled={installing}>
            {installing ? "Installing…" : "Install and restart"}
          </button>
        </div>
      </div>
    </div>
  );
}
