import type { SessionState } from "../session/sessions";

interface SidebarProps {
  sessions: SessionState[];
  activeId?: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onHistory: () => void;
  onSettings: () => void;
  disabled: boolean;
}

/// The session list: one entry per open session (title + directory, active
/// highlighted, a dot while its turn is streaming) plus New-session, History,
/// and Settings.
export function Sidebar({
  sessions,
  activeId,
  onSelect,
  onNew,
  onHistory,
  onSettings,
  disabled,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">C</div>
        <div>
          <div className="brand-name">Claude Workspace</div>
          <div className="brand-subtitle">Local ACP client</div>
        </div>
      </div>
      <div className="sidebar-actions">
        <button className="new-session" onClick={onNew} disabled={disabled}>
          + New session
        </button>
        <button
          className="history-button"
          onClick={onHistory}
          disabled={disabled}
          title="Session history"
        >
          History
        </button>
        <button className="settings-button" onClick={onSettings} title="Settings">
          Settings
        </button>
      </div>
      <div className="sidebar-section-label">Open sessions</div>
      <ul className="session-list">
        {sessions.length === 0 && (
          <li className="session-list-empty">Your active projects will appear here.</li>
        )}
        {sessions.map((session) => (
          <li
            key={session.id}
            className={`session-item${session.id === activeId ? " active" : ""}`}
            onClick={() => onSelect(session.id)}
          >
            <div className="session-title">
              {session.title}
              {session.transcript.turnActive && <span className="session-spinner" />}
            </div>
            <div className="session-cwd" title={session.cwd}>
              {session.cwd}
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
