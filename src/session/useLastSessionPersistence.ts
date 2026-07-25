import { useCallback, useEffect, useRef } from "react";

import type { ConnectionStatus } from "../acp/useAgentConnection";
import { loadLastSession, saveLastSession, type LastSessionRef } from "./lastSession";
import type { SessionState } from "./sessions";

/// Remember which chat was showing and re-open it on launch.
///
/// Only that one chat is loaded: the sidebar lists every persisted chat from
/// `session/list`, and the rest load when clicked. Restoring all of them meant a
/// full history replay per chat, sequentially, before the app was usable.
///
/// Returns a `notifyReset` the connection must call from its onReset (which fires
/// while the socket still reads as "connected", just before a reconnect): it
/// drops hydration so the clear that follows is not mistaken for the user having
/// closed the last chat.
export function useLastSessionPersistence(
  status: ConnectionStatus,
  sessions: SessionState[],
  activeId: string | undefined,
  restore: (ref: LastSessionRef) => Promise<void>,
): () => void {
  // `hydrated` gates saving; `restoring` guards against a double restore;
  // `lastSaved` dedupes writes (the effect re-runs on every streamed token, but
  // the selection rarely changes).
  const hydratedRef = useRef(false);
  const restoringRef = useRef(false);
  const lastSavedRef = useRef("");

  // Restore once per connection: on first connect and after each reconnect.
  useEffect(() => {
    if (status === "connecting") {
      hydratedRef.current = false;
      restoringRef.current = false;
      return;
    }
    if (status !== "connected" || restoringRef.current) return;
    restoringRef.current = true;
    const ref = loadLastSession();
    // Nothing saved is not an error: hydrate straight away so the first
    // selection the user makes is persisted.
    void Promise.resolve(ref && restore(ref)).finally(() => {
      hydratedRef.current = true;
    });
  }, [status, restore]);

  // Persist the selection, but only once hydrated so a transient empty state
  // during (re)connect cannot overwrite what was saved.
  useEffect(() => {
    if (status !== "connected" || !hydratedRef.current) return;
    const active = sessions.find((session) => session.id === activeId);
    const ref = active ? { id: active.id, cwd: active.cwd } : undefined;
    const serialized = JSON.stringify(ref ?? null);
    if (serialized === lastSavedRef.current) return;
    lastSavedRef.current = serialized;
    saveLastSession(ref);
  }, [status, sessions, activeId]);

  return useCallback(() => {
    hydratedRef.current = false;
    restoringRef.current = false;
  }, []);
}
