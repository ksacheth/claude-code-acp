import { useCallback, type Dispatch, type MutableRefObject } from "react";

import { methods, type ClientContext, type SessionInfo } from "@agentclientprotocol/sdk";

import type { SessionsAction } from "./sessions";
import type { OpenSessionsSnapshot } from "./openSessions";
import { toMcpServers, type Settings } from "./settings";

export interface SessionHistory {
  /// List persisted sessions across all directories.
  listSessions: () => Promise<SessionInfo[]>;
  /// Resume a persisted session: its history replays into a rebuilt transcript.
  resumeSession: (info: SessionInfo) => Promise<void>;
  /// Re-open a saved set of sessions on launch (skipping any that fail to load)
  /// and re-select the one that was active.
  restoreSessions: (snapshot: OpenSessionsSnapshot) => Promise<void>;
}

/// Enough of a session to resume it: the load call only needs id and cwd.
type ResumeTarget = { sessionId: string; cwd: string };

/// Create the store session, load it (its history replays into the transcript,
/// routed by id), attach config options, and activate it.
async function resumeInto(
  ctx: ClientContext,
  info: ResumeTarget,
  dispatch: Dispatch<SessionsAction>,
  settings: Settings,
): Promise<void> {
  dispatch({ kind: "create", id: info.sessionId, cwd: info.cwd });
  const response = await ctx.request(methods.agent.session.load, {
    sessionId: info.sessionId,
    cwd: info.cwd,
    mcpServers: toMcpServers(settings.mcpServers),
  });
  // The protocol replays chunks but does not emit a prompt response for that
  // historical work. Close the final replayed assistant message once loading
  // has finished so it is rendered as settled, not as a live response.
  dispatch({ kind: "end", sessionId: info.sessionId });
  if (response.configOptions) {
    dispatch({ kind: "setConfig", sessionId: info.sessionId, configOptions: response.configOptions });
  }
  dispatch({ kind: "activate", id: info.sessionId });
}

/// Resume every session in a saved snapshot, skipping any that fail to load,
/// then re-select the previously-active one (or the last that loaded).
async function restoreAll(
  ctx: ClientContext,
  snapshot: OpenSessionsSnapshot,
  dispatch: Dispatch<SessionsAction>,
  settings: Settings,
): Promise<void> {
  const resumed: string[] = [];
  for (const entry of snapshot.sessions) {
    try {
      await resumeInto(ctx, { sessionId: entry.id, cwd: entry.cwd }, dispatch, settings);
      resumed.push(entry.id);
    } catch (err) {
      console.warn(`[claude-tauri] could not restore session ${entry.id}:`, err);
    }
  }
  const active =
    snapshot.activeId && resumed.includes(snapshot.activeId)
      ? snapshot.activeId
      : resumed[resumed.length - 1];
  if (active) dispatch({ kind: "activate", id: active });
}

/// Browsing and resuming persisted sessions. Separate from live-session actions:
/// it needs only the connection and the set of already-open ids.
export function useSessionHistory(
  ctxRef: MutableRefObject<ClientContext | null>,
  dispatch: Dispatch<SessionsAction>,
  openIds: string[],
  settingsRef: MutableRefObject<Settings>,
): SessionHistory {
  const listSessions = useCallback(async (): Promise<SessionInfo[]> => {
    const ctx = ctxRef.current;
    if (!ctx) return [];
    const response = await ctx.request(methods.agent.session.list, {});
    return response.sessions;
  }, [ctxRef]);

  const resumeSession = useCallback(
    async (info: SessionInfo) => {
      const ctx = ctxRef.current;
      if (!ctx) return;
      // Already open — just show it; re-loading would replay history twice.
      if (openIds.includes(info.sessionId)) {
        dispatch({ kind: "activate", id: info.sessionId });
        return;
      }
      await resumeInto(ctx, info, dispatch, settingsRef.current);
    },
    [ctxRef, dispatch, openIds, settingsRef],
  );

  const restoreSessions = useCallback(
    async (snapshot: OpenSessionsSnapshot) => {
      const ctx = ctxRef.current;
      if (ctx) await restoreAll(ctx, snapshot, dispatch, settingsRef.current);
    },
    [ctxRef, dispatch, settingsRef],
  );

  return { listSessions, resumeSession, restoreSessions };
}
