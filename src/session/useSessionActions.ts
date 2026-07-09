import { useCallback, useRef, useState, type MutableRefObject } from "react";

import { methods, type ClientContext } from "@agentclientprotocol/sdk";
import { open } from "@tauri-apps/plugin-dialog";

import type { TranscriptAction } from "./transcript";

export interface SessionActions {
  /// Working directory of the current session, once chosen.
  cwd?: string;
  /// The current session id, once created.
  sessionId?: string;
  /// Open a directory picker and start a session rooted there.
  pickDirectory: () => Promise<void>;
  /// Send a prompt in the current session and stream the reply.
  sendPrompt: (text: string) => Promise<void>;
  /// Cancel the in-flight turn (session/cancel); partial output is kept.
  cancel: () => Promise<void>;
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
  }, [ctxRef]);

  const sendPrompt = useCallback(
    async (text: string) => {
      const ctx = ctxRef.current;
      if (!ctx || !sessionId) return;
      if (text.trim().length === 0) return;

      const seq = turnSeq.current++;
      dispatch({ kind: "submit", userId: `u${seq}`, assistantId: `a${seq}`, text });
      try {
        await ctx.request(methods.agent.session.prompt, {
          sessionId,
          prompt: [{ type: "text", text }],
        });
      } finally {
        dispatch({ kind: "end" });
      }
    },
    [ctxRef, dispatch, sessionId],
  );

  const cancel = useCallback(async () => {
    const ctx = ctxRef.current;
    if (!ctx || !sessionId) return;
    // Fire-and-forget: the in-flight session/prompt settles as "cancelled",
    // and sendPrompt's finally closes the turn. Partial output is kept.
    await ctx.notify(methods.agent.session.cancel, { sessionId });
  }, [ctxRef, sessionId]);

  const reset = useCallback(() => {
    setCwd(undefined);
    setSessionId(undefined);
  }, []);

  return { cwd, sessionId, pickDirectory, sendPrompt, cancel, reset };
}
