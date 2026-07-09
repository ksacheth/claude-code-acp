import type { SessionState } from "../session/sessions";

interface SidebarProps {
  sessions: SessionState[];
  activeId?: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onHistory: () => void;
  disabled: boolean;
}

/// The session list: one entry per open session (title + directory, active
/// highlighted, a dot while its turn is streaming) plus New-session and History.
export function Sidebar({ sessions, activeId, onSelect, onNew, onHistory, disabled }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-actions">
        <button className="new-session" onClick={onNew} disabled={disabled}>
          + New session
        </button>
        <button className="history-button" onClick={onHistory} disabled={disabled} title="Session history">
          History
        </button>
      </div>
      <ul className="session-list">
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
