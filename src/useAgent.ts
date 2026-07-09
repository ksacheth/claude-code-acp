import { useCallback, useReducer, useRef, useState } from "react";

import type { ClientContext, SessionNotification } from "@agentclientprotocol/sdk";

import {
  useAgentConnection,
  type AgentConnectionHandle,
  type ConnectionStatus,
} from "./acp/useAgentConnection";
import { useSessionActions } from "./session/useSessionActions";
import { emptyTranscript, transcriptReducer, type TranscriptState } from "./session/transcript";
import type { Usage } from "./session/usage";

export type { ConnectionStatus };

export interface AgentState {
  status: ConnectionStatus;
  agentInfo?: AgentConnectionHandle["agentInfo"];
  error?: string;
  /// Working directory of the current session, once chosen.
  cwd?: string;
  transcript: TranscriptState;
  /// Latest context/cost usage, once the engine reports it.
  usage?: Usage;
  /// True while a session exists and no turn is in flight.
  canPrompt: boolean;
  /// True while a turn is streaming (a prompt is in flight).
  turnActive: boolean;
  pickDirectory: () => Promise<void>;
  sendPrompt: (text: string) => Promise<void>;
  cancel: () => Promise<void>;
  reconnect: () => Promise<void>;
}

/// Composes the connection lifecycle and session interaction into the single
/// state object the UI consumes. The `ctxRef` is owned here and shared with
/// both hooks: the connection writes it, session actions read it.
export function useAgent(): AgentState {
  const ctxRef = useRef<ClientContext | null>(null);
  const [transcript, dispatch] = useReducer(transcriptReducer, emptyTranscript);
  const [usage, setUsage] = useState<Usage>();

  const onUpdate = useCallback((notification: SessionNotification) => {
    const update = notification.update;
    if (update.sessionUpdate === "usage_update") {
      setUsage({ used: update.used, size: update.size, cost: update.cost });
      return;
    }
    dispatch({ kind: "update", update });
  }, []);

  const session = useSessionActions(ctxRef, dispatch);
  const connection = useAgentConnection(ctxRef, onUpdate, session.reset);

  return {
    status: connection.status,
    agentInfo: connection.agentInfo,
    error: connection.error,
    cwd: session.cwd,
    transcript,
    usage,
    canPrompt:
      connection.status === "connected" && !!session.sessionId && !transcript.turnActive,
    turnActive: transcript.turnActive,
    pickDirectory: session.pickDirectory,
    sendPrompt: session.sendPrompt,
    cancel: session.cancel,
    reconnect: connection.reconnect,
  };
}
