/// The chat that was showing when the app last closed, so it can be re-opened on
/// launch. Its id and project directory are all `session/load` needs; the engine
/// owns the conversation itself (under `~/.claude`).
///
/// Only the active chat is remembered. Every chat is listed in the sidebar from
/// `session/list`, so there is nothing to restore beyond the selection, and
/// loading one conversation instead of all of them keeps launch fast.
export interface LastSessionRef {
  id: string;
  cwd: string;
}

const STORAGE_KEY = "claude-tauri.openSessions";

/// Load the remembered chat, tolerating absent or corrupt data.
export function loadLastSession(
  storage: Pick<Storage, "getItem"> = localStorage,
): LastSessionRef | undefined {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    return normalizeLastSession(JSON.parse(raw));
  } catch {
    return undefined;
  }
}

/// Persist the active chat (or clear it when none is open). Never throws:
/// a failed write only costs the next launch its selection.
export function saveLastSession(
  ref: LastSessionRef | undefined,
  storage: Pick<Storage, "setItem"> = localStorage,
): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(ref ? { active: ref } : {}));
  } catch {
    // Storage can be full or blocked; the running app is unaffected.
  }
}

/// Coerce an untrusted parsed blob into a ref.
///
/// Two shapes are accepted: the current `{ active: { id, cwd } }`, and the
/// pre-M7 `{ sessions: [{ id, cwd }], activeId }` list, whose active entry is
/// pulled out so an existing install keeps its selection after the upgrade.
export function normalizeLastSession(input: unknown): LastSessionRef | undefined {
  const raw = (input ?? {}) as Record<string, unknown>;
  return asRef(raw.active) ?? fromOpenSessionsList(raw);
}

function asRef(value: unknown): LastSessionRef | undefined {
  const entry = (value ?? {}) as Record<string, unknown>;
  return typeof entry.id === "string" && entry.id && typeof entry.cwd === "string" && entry.cwd
    ? { id: entry.id, cwd: entry.cwd }
    : undefined;
}

/// Read the active entry out of the pre-M7 open-session list.
function fromOpenSessionsList(raw: Record<string, unknown>): LastSessionRef | undefined {
  if (!Array.isArray(raw.sessions)) return undefined;
  const refs = raw.sessions.flatMap((entry) => {
    const ref = asRef(entry);
    return ref ? [ref] : [];
  });
  if (!refs.length) return undefined;
  const active = typeof raw.activeId === "string" ? raw.activeId : undefined;
  // Without a usable activeId, fall back to the last one opened, which is what
  // the old restore path would have selected.
  return refs.find((ref) => ref.id === active) ?? refs[refs.length - 1];
}
