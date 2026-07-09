import { useCallback, type Dispatch, type MutableRefObject } from "react";

import { methods, type ClientContext, type SessionInfo } from "@agentclientprotocol/sdk";

import type { SessionsAction } from "./sessions";
import { toMcpServers, type Settings } from "./settings";

export interface SessionHistory {
  /// List persisted sessions across all directories.
  listSessions: () => Promise<SessionInfo[]>;
  /// Resume a persisted session: its history replays into a rebuilt transcript.
  resumeSession: (info: SessionInfo) => Promise<void>;
}

/// Create the store session, load it (its history replays into the transcript,
/// routed by id), attach config options, and activate it.
async function resumeInto(
  ctx: ClientContext,
  info: SessionInfo,
  dispatch: Dispatch<SessionsAction>,
  settings: Settings,
): Promise<void> {
  dispatch({ kind: "create", id: info.sessionId, cwd: info.cwd });
  const response = await ctx.request(methods.agent.session.load, {
    sessionId: info.sessionId,
    cwd: info.cwd,
    mcpServers: toMcpServers(settings.mcpServers),
  });
  if (response.configOptions) {
    dispatch({ kind: "setConfig", sessionId: info.sessionId, configOptions: response.configOptions });
  }
  dispatch({ kind: "activate", id: info.sessionId });
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

  return { listSessions, resumeSession };
}
