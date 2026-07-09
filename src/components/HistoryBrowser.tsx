import type { SessionInfo } from "@agentclientprotocol/sdk";

import { formatRelativeTime } from "../session/relativeTime";
import { titleFromCwd } from "../session/sessions";

interface HistoryBrowserProps {
  /// null while loading; an array (possibly empty) once fetched.
  sessions: SessionInfo[] | null;
  nowMs: number;
  onResume: (info: SessionInfo) => void;
  onClose: () => void;
}

/// Sort persisted sessions most-recently-updated first.
export function sortByRecency(sessions: SessionInfo[]): SessionInfo[] {
  return [...sessions].sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
}

/// A modal listing persisted sessions; clicking one resumes it.
export function HistoryBrowser({ sessions, nowMs, onResume, onClose }: HistoryBrowserProps) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal history-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Session history</div>
        {sessions === null ? (
          <div className="muted">Loading…</div>
        ) : sessions.length === 0 ? (
          <div className="muted">No past sessions.</div>
        ) : (
          <ul className="history-list">
            {sortByRecency(sessions).map((session) => (
              <li key={session.sessionId} className="history-item" onClick={() => onResume(session)}>
                <div className="history-title">{session.title || titleFromCwd(session.cwd)}</div>
                <div className="history-meta">
                  <span className="history-cwd" title={session.cwd}>
                    {session.cwd}
                  </span>
                  {session.updatedAt && (
                    <span className="history-time">{formatRelativeTime(session.updatedAt, nowMs)}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
