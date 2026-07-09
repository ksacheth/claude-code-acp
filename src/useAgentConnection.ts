import { useEffect, useRef, useState } from "react";

import type { SessionNotification } from "@agentclientprotocol/sdk";

import { connectAgent, type AgentConnection } from "./acp/connection";
import { startAgent, stopAgent, tauriChannel } from "./acp/tauriChannel";

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

export interface AgentConnectionState {
  status: ConnectionStatus;
  agentInfo?: AgentConnection["agentInfo"];
  error?: string;
}

/// Starts the engine, completes the ACP handshake, and tracks connection state
/// for the app's lifetime. The connection (and the underlying process) is torn
/// down on unmount.
export function useAgentConnection(): AgentConnectionState {
  const [state, setState] = useState<AgentConnectionState>({ status: "connecting" });
  // Guards against acting after unmount and against double-connect.
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    let disposed = false;

    (async () => {
      try {
        await startAgent();
        const conn = await connectAgent(tauriChannel, {
          onSessionUpdate: (update: SessionNotification) => {
            // T4 renders these; for C1 they are just visible in the console.
            console.debug("[acp] session update", update);
          },
        });
        if (disposed) {
          await stopAgent();
          return;
        }
        setState({ status: "connected", agentInfo: conn.agentInfo });
        conn.closed.then(() => {
          if (!disposed) setState((s) => ({ ...s, status: "disconnected" }));
        });
      } catch (err) {
        if (!disposed) setState({ status: "error", error: String(err) });
      }
    })();

    return () => {
      disposed = true;
      void stopAgent();
    };
  }, []);

  return state;
}
