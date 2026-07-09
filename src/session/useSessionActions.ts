import { useCallback, useRef, type Dispatch, type MutableRefObject } from "react";

import { methods, type ClientContext } from "@agentclientprotocol/sdk";
import { open } from "@tauri-apps/plugin-dialog";

import type { SessionsAction } from "./sessions";

export interface SessionActions {
  /// Open a directory picker and start a new session rooted there (made active).
  newSession: () => Promise<void>;
  /// Show an existing session.
  switchSession: (id: string) => void;
  /// Send a prompt in the active session and stream the reply.
  sendPrompt: (text: string) => Promise<void>;
  /// Cancel the active session's in-flight turn; partial output is kept.
  cancel: () => Promise<void>;
  /// Set one of the active session's config options (mode/model/effort/agent),
  /// optimistically; the engine's response replaces the whole set.
  setConfig: (configId: string, value: string) => Promise<void>;
}

interface TurnDeps {
  ctx: ClientContext;
  sessionId: string;
  text: string;
  seq: number;
  dispatch: Dispatch<SessionsAction>;
}

/// Run one prompt turn in a session: open the assistant message, stream the
/// reply, then close the turn even if the request rejects or is cancelled.
async function runPromptTurn({ ctx, sessionId, text, seq, dispatch }: TurnDeps): Promise<void> {
  dispatch({ kind: "submit", sessionId, userId: `u${seq}`, assistantId: `a${seq}`, text });
  try {
    await ctx.request(methods.agent.session.prompt, {
      sessionId,
      prompt: [{ type: "text", text }],
    });
  } finally {
    dispatch({ kind: "end", sessionId });
  }
}

/// Session interaction over the sessions store. Reads the shared `ctxRef` (owned
/// by the connection hook) and dispatches into the store. `activeId` is the
/// session that prompt/cancel/mode actions target.
export function useSessionActions(
  ctxRef: MutableRefObject<ClientContext | null>,
  dispatch: Dispatch<SessionsAction>,
  activeId: string | undefined,
): SessionActions {
  const turnSeq = useRef(0);

  // Run `op` only when there is a live context and an active session.
  const withActive = useCallback(
    <T>(op: (ctx: ClientContext, sessionId: string) => T): T | undefined => {
      const ctx = ctxRef.current;
      if (!ctx || !activeId) return undefined;
      return op(ctx, activeId);
    },
    [ctxRef, activeId],
  );

  const newSession = useCallback(async () => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected !== "string") return;
    const response = await ctx.request(methods.agent.session.new, {
      cwd: selected,
      mcpServers: [],
    });
    dispatch({
      kind: "create",
      id: response.sessionId,
      cwd: selected,
      configOptions: response.configOptions ?? undefined,
    });
  }, [ctxRef, dispatch]);

  const switchSession = useCallback((id: string) => dispatch({ kind: "activate", id }), [dispatch]);

  const sendPrompt = useCallback(
    async (text: string) => {
      if (text.trim().length === 0) return;
      await withActive((ctx, sessionId) =>
        runPromptTurn({ ctx, sessionId, text, seq: turnSeq.current++, dispatch }),
      );
    },
    [withActive, dispatch],
  );

  const cancel = useCallback(
    () => Promise.resolve(withActive((ctx, id) => ctx.notify(methods.agent.session.cancel, { sessionId: id }))),
    [withActive],
  );

  const setConfig = useCallback(
    async (configId: string, value: string) => {
      await withActive(async (ctx, id) => {
        // Optimistic: reflect the new value immediately.
        dispatch({ kind: "patchConfig", sessionId: id, configId, value });
        // The response carries the full, reconciled set (e.g. the effort list
        // changes when the model changes), so it's the authoritative replace.
        const response = await ctx.request(methods.agent.session.setConfigOption, {
          sessionId: id,
          configId,
          value,
        });
        dispatch({ kind: "setConfig", sessionId: id, configOptions: response.configOptions });
      });
    },
    [withActive, dispatch],
  );

  return { newSession, switchSession, sendPrompt, cancel, setConfig };
}
