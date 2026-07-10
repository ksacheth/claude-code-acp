import { useCallback, useEffect, useRef } from "react";

import type { ConnectionStatus } from "../acp/useAgentConnection";
import { loadOpenSessions, saveOpenSessions, type OpenSessionsSnapshot } from "./openSessions";
import type { SessionState } from "./sessions";

/// Persist the open-session list and restore it on launch, so the sidebar comes
/// back as it was left across relaunches and app updates.
///
/// Returns a `notifyReset` the connection must call from its onReset (which
/// fires while the socket is still "connected", just before a reconnect): it
/// drops hydration so the clear that follows isn't mistaken for the user having
/// closed every session and persisted as an empty list.
export function useOpenSessionsPersistence(
  status: ConnectionStatus,
  sessions: SessionState[],
  activeId: string | undefined,
  restore: (snapshot: OpenSessionsSnapshot) => Promise<void>,
): () => void {
  // `hydrated` gates saving; `restoring` guards against a double restore;
  // `lastSaved` dedupes writes (the effect re-runs on every streamed token, but
  // the id/cwd list rarely changes).
  const hydratedRef = useRef(false);
  const restoringRef = useRef(false);
  const lastSavedRef = useRef("");

  // Restore once per connection — on first connect and after each reconnect.
  useEffect(() => {
    if (status === "connecting") {
      hydratedRef.current = false;
      restoringRef.current = false;
      return;
    }
    if (status !== "connected" || restoringRef.current) return;
    restoringRef.current = true;
    void restore(loadOpenSessions()).finally(() => {
      hydratedRef.current = true;
    });
  }, [status, restore]);

  // Persist the current open set, but only once hydrated so a transient empty
  // state during (re)connect can't overwrite the saved list.
  useEffect(() => {
    if (status !== "connected" || !hydratedRef.current) return;
    const snapshot = { sessions: sessions.map((s) => ({ id: s.id, cwd: s.cwd })), activeId };
    const serialized = JSON.stringify(snapshot);
    if (serialized === lastSavedRef.current) return;
    lastSavedRef.current = serialized;
    saveOpenSessions(snapshot);
  }, [status, sessions, activeId]);

  return useCallback(() => {
    hydratedRef.current = false;
    restoringRef.current = false;
  }, []);
}
