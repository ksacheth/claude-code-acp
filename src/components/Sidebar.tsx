import type { SessionState } from "../session/sessions";

interface SidebarProps {
  sessions: SessionState[];
  activeId?: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  disabled: boolean;
}

/// The session list: one entry per open session (title + directory, active
/// highlighted, a dot while its turn is streaming) plus a New-session button.
export function Sidebar({ sessions, activeId, onSelect, onNew, disabled }: SidebarProps) {
  return (
    <aside className="sidebar">
      <button className="new-session" onClick={onNew} disabled={disabled}>
        + New session
      </button>
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
