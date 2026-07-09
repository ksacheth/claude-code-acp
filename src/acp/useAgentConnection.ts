import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import { useState } from "react";

import type { ClientContext, SessionNotification } from "@agentclientprotocol/sdk";

import { connectAgent, type AgentConnection } from "./connection";
import { startAgent, stopAgent, tauriChannel } from "./tauriChannel";

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

export interface AgentConnectionHandle {
  status: ConnectionStatus;
  agentInfo?: AgentConnection["agentInfo"];
  error?: string;
  reconnect: () => Promise<void>;
}

/// Owns the engine process + ACP connection lifecycle: start, handshake, track
/// status, and reconnect. Writes the live `ClientContext` into `ctxRef` (shared
/// with session actions) and forwards session updates to `onUpdate`. `onReset`
/// runs before a reconnect so callers can clear session state.
export function useAgentConnection(
  ctxRef: MutableRefObject<ClientContext | null>,
  onUpdate: (notification: SessionNotification) => void,
  onReset: () => void,
): AgentConnectionHandle {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [agentInfo, setAgentInfo] = useState<AgentConnection["agentInfo"]>();
  const [error, setError] = useState<string>();
  const disposedRef = useRef(false);
  const startedRef = useRef(false);

  const connect = useCallback(async () => {
    setError(undefined);
    setStatus("connecting");
    const startedAt = performance.now();
    try {
      await startAgent();
      const conn = await connectAgent(tauriChannel, { onSessionUpdate: onUpdate });
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
  }, [ctxRef, onUpdate]);

  const reconnect = useCallback(async () => {
    await stopAgent().catch(() => {});
    onReset();
    await connect();
  }, [connect, onReset]);

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

  return { status, agentInfo, error, reconnect };
}
