import { useCallback, useState, type Dispatch, type MutableRefObject } from "react";

import { methods, type ClientContext, type SessionInfo } from "@agentclientprotocol/sdk";

import type { SessionsAction } from "./sessions";
import type { LastSessionRef } from "./lastSession";
import { toMcpServers, type Settings } from "./settings";

export type DeleteSessionTarget = Pick<SessionInfo, "sessionId">;

/// Enough of a chat to rename it. `cwd` lets the engine find the session file
/// without loading the conversation, so a chat can be renamed from the sidebar.
export interface RenameSessionTarget {
  sessionId: string;
  cwd: string;
}

/// ACP has no rename method; the engine exposes one as this extension request.
const RENAME_SESSION_METHOD = "_claude/session/rename";

export interface SessionHistory {
  /// Every persisted chat across all directories. `null` until the first load
  /// finishes, which the sidebar shows as "loading" rather than "empty".
  list: SessionInfo[] | null;
  /// Re-read the persisted list (after a turn, a delete, or a new chat).
  refreshList: () => Promise<void>;
  /// Permanently remove a persisted conversation and close any open copy.
  deleteSession: (info: DeleteSessionTarget) => Promise<void>;
  /// Retitle a chat, open or not.
  renameSession: (target: RenameSessionTarget, title: string) => Promise<void>;
  /// Resume a persisted chat: its history replays into a rebuilt transcript.
  /// Already-open chats are just activated, since re-loading replays twice.
  resumeSession: (info: SessionInfo) => Promise<void>;
  /// Re-open the chat that was showing when the app last closed.
  restoreLast: (ref: LastSessionRef) => Promise<void>;
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
    dispatch({
      kind: "setConfig",
      sessionId: info.sessionId,
      configOptions: response.configOptions,
    });
  }
  dispatch({ kind: "activate", id: info.sessionId });
}

/// Browsing, resuming, and retitling persisted chats. Separate from live-session
/// actions: it needs only the connection and the set of already-open ids.
export function useSessionHistory(
  ctxRef: MutableRefObject<ClientContext | null>,
  dispatch: Dispatch<SessionsAction>,
  openIds: string[],
  settingsRef: MutableRefObject<Settings>,
): SessionHistory {
  const [list, setList] = useState<SessionInfo[] | null>(null);

  // Every action here needs a live connection and nothing else; without one it is
  // a no-op rather than an error, since the UI stays visible while disconnected.
  const withCtx = useCallback(
    (op: (ctx: ClientContext) => Promise<void>): Promise<void> => {
      const ctx = ctxRef.current;
      return ctx ? op(ctx) : Promise.resolve();
    },
    [ctxRef],
  );

  const refreshList = useCallback(
    () =>
      withCtx(async (ctx) => {
        const response = await ctx.request(methods.agent.session.list, {});
        setList(response.sessions);
      }),
    [withCtx],
  );

  const resumeSession = useCallback(
    (info: SessionInfo) =>
      withCtx(async (ctx) => {
        // Already open — just show it; re-loading would replay history twice.
        if (openIds.includes(info.sessionId)) {
          dispatch({ kind: "activate", id: info.sessionId });
          return;
        }
        await resumeInto(ctx, info, dispatch, settingsRef.current);
      }),
    [withCtx, dispatch, openIds, settingsRef],
  );

  const deleteSession = useCallback(
    (info: DeleteSessionTarget) =>
      withCtx(async (ctx) => {
        await ctx.request(methods.agent.session.delete, { sessionId: info.sessionId });
        dispatch({ kind: "remove", id: info.sessionId });
        setList((sessions) => sessions?.filter((s) => s.sessionId !== info.sessionId) ?? null);
      }),
    [withCtx, dispatch],
  );

  const renameSession = useCallback(
    (target: RenameSessionTarget, title: string) =>
      withCtx(async (ctx) => {
        // The engine sanitizes the title (collapsing whitespace, truncating), so
        // its response is what to display, not what was typed.
        const response = await ctx.request<{ title?: string }>(RENAME_SESSION_METHOD, {
          sessionId: target.sessionId,
          title,
          cwd: target.cwd,
        });
        const stored = typeof response?.title === "string" ? response.title : title.trim();
        dispatch({ kind: "setTitle", sessionId: target.sessionId, title: stored });
        setList(
          (sessions) =>
            sessions?.map((s) =>
              s.sessionId === target.sessionId ? { ...s, title: stored } : s,
            ) ?? null,
        );
      }),
    [withCtx, dispatch],
  );

  const restoreLast = useCallback(
    (ref: LastSessionRef) =>
      withCtx(async (ctx) => {
        try {
          await resumeInto(ctx, { sessionId: ref.id, cwd: ref.cwd }, dispatch, settingsRef.current);
        } catch (err) {
          // A deleted or unreadable chat must not block startup: the sidebar still
          // lists everything, so the user can pick another.
          console.warn(`[claude-tauri] could not restore session ${ref.id}:`, err);
          dispatch({ kind: "remove", id: ref.id });
        }
      }),
    [withCtx, dispatch, settingsRef],
  );

  return { list, refreshList, deleteSession, renameSession, resumeSession, restoreLast };
}
