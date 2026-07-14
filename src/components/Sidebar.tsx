import type { SessionState } from "../session/sessions";
import { SidebarToggleButton } from "./SidebarToggleButton";

interface SidebarProps {
  sessions: SessionState[];
  activeId?: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onHistory: () => void;
  onSettings: () => void;
  onCollapse: () => void;
  onDelete: (session: SessionState) => void;
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
  onCollapse,
  onDelete,
  disabled,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">C</div>
        <div className="sidebar-brand-copy">
          <div className="brand-name">Claude Workspace</div>
          <div className="brand-subtitle">Local ACP client</div>
        </div>
        <SidebarToggleButton expanded onClick={onCollapse} />
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
          >
            <button type="button" className="session-open" onClick={() => onSelect(session.id)}>
              <div className="session-title">
                {session.title}
                {session.transcript.turnActive && <span className="session-spinner" />}
              </div>
              <div className="session-cwd" title={session.cwd}>
                {session.cwd}
              </div>
            </button>
            <button
              type="button"
              className="session-delete"
              aria-label={`Delete ${session.title}`}
              title={`Delete ${session.title}`}
              onClick={() => onDelete(session)}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M4 7h16" />
                <path d="M9 7V4h6v3" />
                <path d="m7 7 1 13h8l1-13" />
                <path d="M10 11v5M14 11v5" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
