/// The minimum needed to re-open a session on launch: its id and project dir.
/// The engine persists the conversation itself (under ~/.claude), so this is
/// only a pointer list — resuming by id replays the real history.
export interface OpenSessionRef {
  id: string;
  cwd: string;
}

/// The sidebar's open-session list plus which one was showing, persisted so the
/// workspace comes back as it was left (across relaunches and app updates).
export interface OpenSessionsSnapshot {
  sessions: OpenSessionRef[];
  activeId?: string;
}

export const emptyOpenSessions: OpenSessionsSnapshot = { sessions: [] };

const STORAGE_KEY = "claude-tauri.openSessions";

/// Load the persisted open-session list, tolerating absent or corrupt data.
export function loadOpenSessions(
  storage: Pick<Storage, "getItem"> = localStorage,
): OpenSessionsSnapshot {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return emptyOpenSessions;
    return normalizeOpenSessions(JSON.parse(raw));
  } catch {
    return emptyOpenSessions;
  }
}

/// Persist the open-session list. Never throws (storage may be full/blocked).
export function saveOpenSessions(
  snapshot: OpenSessionsSnapshot,
  storage: Pick<Storage, "setItem"> = localStorage,
): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // A failed write just means the sidebar won't restore; not worth surfacing.
  }
}

/// Coerce an untrusted parsed blob into a valid snapshot: keep only entries with
/// a string id and cwd, and an activeId that still refers to one of them.
export function normalizeOpenSessions(input: unknown): OpenSessionsSnapshot {
  const raw = (input ?? {}) as Record<string, unknown>;
  const list = Array.isArray(raw.sessions) ? raw.sessions : [];
  const sessions = list.flatMap((v) => {
    const entry = v as Record<string, unknown>;
    return typeof entry?.id === "string" && typeof entry?.cwd === "string"
      ? [{ id: entry.id, cwd: entry.cwd }]
      : [];
  });
  const activeId =
    typeof raw.activeId === "string" && sessions.some((s) => s.id === raw.activeId)
      ? raw.activeId
      : undefined;
  return { sessions, activeId };
}
