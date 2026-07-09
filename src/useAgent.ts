import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { methods, type ClientContext } from "@agentclientprotocol/sdk";
import { open } from "@tauri-apps/plugin-dialog";

import { connectAgent, type AgentConnection } from "./acp/connection";
import { startAgent, stopAgent, tauriChannel } from "./acp/tauriChannel";
import {
  emptyTranscript,
  transcriptReducer,
  type TranscriptState,
} from "./session/transcript";

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

export interface AgentState {
  status: ConnectionStatus;
  agentInfo?: AgentConnection["agentInfo"];
  error?: string;
  /// Working directory of the current session, once chosen.
  cwd?: string;
  transcript: TranscriptState;
  /// True while a session exists and no turn is in flight.
  canPrompt: boolean;
  /// Open a directory picker and start a session rooted there.
  pickDirectory: () => Promise<void>;
  /// Send a prompt in the current session and stream the reply.
  sendPrompt: (text: string) => Promise<void>;
  /// Restart the engine and reconnect (e.g. after a crash/disconnect).
  reconnect: () => Promise<void>;
}

/// Owns the whole M0 chat lifecycle: start the engine, complete the handshake,
/// create one session against a chosen directory, and stream prompt replies
/// into a transcript.
export function useAgent(): AgentState {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [agentInfo, setAgentInfo] = useState<AgentConnection["agentInfo"]>();
  const [error, setError] = useState<string>();
  const [cwd, setCwd] = useState<string>();
  const [sessionId, setSessionId] = useState<string>();
  const [transcript, dispatch] = useReducer(transcriptReducer, emptyTranscript);

  const ctxRef = useRef<ClientContext | null>(null);
  const disposedRef = useRef(false);
  const startedRef = useRef(false);
  const turnSeq = useRef(0);

  const connect = useCallback(async () => {
    setError(undefined);
    setStatus("connecting");
    const startedAt = performance.now();
    try {
      await startAgent();
      const conn = await connectAgent(tauriChannel, {
        onSessionUpdate: (notification) => {
          dispatch({ kind: "update", update: notification.update });
        },
      });
      if (disposedRef.current) {
        await stopAgent();
        return;
      }
      ctxRef.current = conn.ctx;
      setAgentInfo(conn.agentInfo);
      setStatus("connected");
      // Cold-start budget: launch -> handshake complete (first usable prompt).
      console.info(`[claude-tauri] connected in ${Math.round(performance.now() - startedAt)}ms`);
      conn.closed.then(() => {
        if (!disposedRef.current) {
          ctxRef.current = null;
          setStatus("disconnected");
        }
      });
    } catch (err) {
      if (!disposedRef.current) {
        setError(String(err));
        setStatus("error");
      }
    }
  }, []);

  const reconnect = useCallback(async () => {
    // Clear any prior process before starting a fresh one.
    await stopAgent().catch(() => {});
    setSessionId(undefined);
    setCwd(undefined);
    await connect();
  }, [connect]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    disposedRef.current = false;
    void connect();

    return () => {
      disposedRef.current = true;
      void stopAgent();
    };
  }, [connect]);

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
  }, []);

  const sendPrompt = useCallback(
    async (text: string) => {
      const ctx = ctxRef.current;
      if (!ctx || !sessionId || text.trim().length === 0) return;

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
    [sessionId],
  );

  return {
    status,
    agentInfo,
    error,
    cwd,
    transcript,
    canPrompt: status === "connected" && !!sessionId && !transcript.turnActive,
    pickDirectory,
    sendPrompt,
    reconnect,
  };
}
