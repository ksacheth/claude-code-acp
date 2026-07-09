import { useCallback, useRef, useState, type MutableRefObject } from "react";

import {
  methods,
  type ClientContext,
  type SessionModeId,
  type SessionModeState,
} from "@agentclientprotocol/sdk";
import { open } from "@tauri-apps/plugin-dialog";

import type { TranscriptAction } from "./transcript";

interface TurnDeps {
  ctx: ClientContext;
  sessionId: string;
  text: string;
  seq: number;
  dispatch: (action: TranscriptAction) => void;
}

/// Run one prompt turn: open the assistant message, stream the reply, then close
/// the turn even if the request rejects or is cancelled.
async function runPromptTurn({ ctx, sessionId, text, seq, dispatch }: TurnDeps): Promise<void> {
  dispatch({ kind: "submit", userId: `u${seq}`, assistantId: `a${seq}`, text });
  try {
    await ctx.request(methods.agent.session.prompt, {
      sessionId,
      prompt: [{ type: "text", text }],
    });
  } finally {
    dispatch({ kind: "end" });
  }
}

export interface SessionActions {
  /// Working directory of the current session, once chosen.
  cwd?: string;
  /// The current session id, once created.
  sessionId?: string;
  /// Available modes and the active one, if the agent advertises modes.
  modes?: SessionModeState;
  /// Open a directory picker and start a session rooted there.
  pickDirectory: () => Promise<void>;
  /// Send a prompt in the current session and stream the reply.
  sendPrompt: (text: string) => Promise<void>;
  /// Cancel the in-flight turn (session/cancel); partial output is kept.
  cancel: () => Promise<void>;
  /// Switch the session mode (session/set_mode), optimistically updating.
  setMode: (modeId: SessionModeId) => Promise<void>;
  /// Apply an agent-driven mode change (from current_mode_update).
  applyModeUpdate: (modeId: SessionModeId) => void;
  /// Forget the current session (used on reconnect).
  reset: () => void;
}

/// Session interaction on top of a live connection. Reads the shared `ctxRef`
/// (owned by the connection hook) and dispatches transcript updates.
export function useSessionActions(
  ctxRef: MutableRefObject<ClientContext | null>,
  dispatch: (action: TranscriptAction) => void,
): SessionActions {
  const [cwd, setCwd] = useState<string>();
  const [sessionId, setSessionId] = useState<string>();
  const [modes, setModes] = useState<SessionModeState>();
  const turnSeq = useRef(0);

  const pickDirectory = useCallback(async () => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected !== "string") return;
    const response = await ctx.request(methods.agent.session.new, {
      cwd: selected,
      mcpServers: [],
    });
    setCwd(selected);
    setSessionId(response.sessionId);
    setModes(response.modes ?? undefined);
  }, [ctxRef]);

  // Run `op` only when there is a live context and an active session.
  const withSession = useCallback(
    <T>(op: (ctx: ClientContext, sessionId: string) => T): T | undefined => {
      const ctx = ctxRef.current;
      if (!ctx || !sessionId) return undefined;
      return op(ctx, sessionId);
    },
    [ctxRef, sessionId],
  );

  const sendPrompt = useCallback(
    async (text: string) => {
      if (text.trim().length === 0) return;
      await withSession((ctx, sessionId) =>
        runPromptTurn({ ctx, sessionId, text, seq: turnSeq.current++, dispatch }),
      );
    },
    [withSession, dispatch],
  );

  // Fire-and-forget: the in-flight session/prompt settles as "cancelled", and
  // sendPrompt's finally closes the turn. Partial output is kept.
  const cancel = useCallback(
    () => Promise.resolve(withSession((ctx, id) => ctx.notify(methods.agent.session.cancel, { sessionId: id }))),
    [withSession],
  );

  const applyModeUpdate = useCallback((modeId: SessionModeId) => {
    setModes((prev) => (prev ? { ...prev, currentModeId: modeId } : prev));
  }, []);

  const setMode = useCallback(
    async (modeId: SessionModeId) => {
      await withSession((ctx, id) => {
        applyModeUpdate(modeId); // optimistic; current_mode_update confirms
        return ctx.request(methods.agent.session.setMode, { sessionId: id, modeId });
      });
    },
    [withSession, applyModeUpdate],
  );

  const reset = useCallback(() => {
    setCwd(undefined);
    setSessionId(undefined);
    setModes(undefined);
  }, []);

  return { cwd, sessionId, modes, pickDirectory, sendPrompt, cancel, setMode, applyModeUpdate, reset };
}
