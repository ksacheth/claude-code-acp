import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import { useState } from "react";

import type {
  ClientContext,
  RequestPermissionRequest,
  RequestPermissionResponse,
  SessionNotification,
} from "@agentclientprotocol/sdk";

import { connectAgent, type AgentConnection } from "./connection";
import { startAgent, stopAgent, tauriChannel } from "./tauriChannel";
import type { Settings } from "../session/settings";

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

export interface AgentConnectionHandle {
  status: ConnectionStatus;
  agentInfo?: AgentConnection["agentInfo"];
  error?: string;
  reconnect: () => Promise<void>;
}

/// The event handlers the connection drives: streaming updates, permission
/// prompts, and a pre-reconnect reset so callers can clear session state.
export interface ConnectionHandlers {
  onUpdate: (notification: SessionNotification) => void;
  onPermissionRequest: (request: RequestPermissionRequest) => Promise<RequestPermissionResponse>;
  onReset: () => void;
}

/// Owns the engine process + ACP connection lifecycle: start, handshake, track
/// status, and reconnect. Writes the live `ClientContext` into `ctxRef` (shared
/// with session actions) and reads the spawn config from `settingsRef` at
/// connect time.
export function useAgentConnection(
  ctxRef: MutableRefObject<ClientContext | null>,
  settingsRef: MutableRefObject<Settings>,
  handlers: ConnectionHandlers,
): AgentConnectionHandle {
  const { onUpdate, onPermissionRequest, onReset } = handlers;
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
      const { enginePath, nodePath, env } = settingsRef.current;
      await startAgent({ enginePath, nodePath, env });
      const conn = await connectAgent(tauriChannel, {
        onSessionUpdate: onUpdate,
        onPermissionRequest,
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
  }, [ctxRef, onUpdate, onPermissionRequest, settingsRef]);

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
