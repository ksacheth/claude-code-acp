import { useCallback, useReducer, useRef, useState } from "react";

import type {
  ClientContext,
  RequestPermissionRequest,
  RequestPermissionResponse,
  SessionNotification,
} from "@agentclientprotocol/sdk";

import {
  useAgentConnection,
  type AgentConnectionHandle,
  type ConnectionStatus,
} from "./acp/useAgentConnection";
import { useSessionActions } from "./session/useSessionActions";
import { routeSessionUpdate } from "./session/routeUpdate";
import { emptyTranscript, transcriptReducer, type TranscriptState } from "./session/transcript";
import type { Usage } from "./session/usage";

import type { PlanEntry, SessionModeId, SessionModeState } from "@agentclientprotocol/sdk";

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
  /// The current execution plan, if the agent is planning.
  plan?: PlanEntry[];
  /// True while a session exists and no turn is in flight.
  canPrompt: boolean;
  /// True while a turn is streaming (a prompt is in flight).
  turnActive: boolean;
  /// Available modes and the active one, if the agent advertises modes.
  modes?: SessionModeState;
  /// A permission request awaiting the user's decision, if any.
  permission?: RequestPermissionRequest;
  pickDirectory: () => Promise<void>;
  sendPrompt: (text: string) => Promise<void>;
  cancel: () => Promise<void>;
  /// Switch the session mode.
  setMode: (modeId: SessionModeId) => Promise<void>;
  /// Answer the pending permission request.
  resolvePermission: (response: RequestPermissionResponse) => void;
  reconnect: () => Promise<void>;
}

/// Composes the connection lifecycle and session interaction into the single
/// state object the UI consumes. The `ctxRef` is owned here and shared with
/// both hooks: the connection writes it, session actions read it.
export function useAgent(): AgentState {
  const ctxRef = useRef<ClientContext | null>(null);
  const [transcript, dispatch] = useReducer(transcriptReducer, emptyTranscript);
  const [usage, setUsage] = useState<Usage>();
  const [plan, setPlan] = useState<PlanEntry[]>();
  const [permission, setPermission] = useState<RequestPermissionRequest>();
  // The pending resolver is held in a ref so resolving is a plain side effect,
  // not work inside a state updater.
  const resolverRef = useRef<((response: RequestPermissionResponse) => void) | null>(null);

  const session = useSessionActions(ctxRef, dispatch);
  const { applyModeUpdate } = session;

  const onUpdate = useCallback(
    (notification: SessionNotification) => {
      routeSessionUpdate(notification.update, {
        onUsage: setUsage,
        onModeChange: applyModeUpdate,
        onPlan: setPlan,
        onTranscript: (update) => dispatch({ kind: "update", update }),
      });
    },
    [applyModeUpdate],
  );

  const onPermissionRequest = useCallback((request: RequestPermissionRequest) => {
    return new Promise<RequestPermissionResponse>((resolve) => {
      resolverRef.current = resolve;
      setPermission(request);
    });
  }, []);

  const resolvePermission = useCallback((response: RequestPermissionResponse) => {
    resolverRef.current?.(response);
    resolverRef.current = null;
    setPermission(undefined);
  }, []);

  const connection = useAgentConnection(ctxRef, onUpdate, onPermissionRequest, session.reset);

  return {
    status: connection.status,
    agentInfo: connection.agentInfo,
    error: connection.error,
    cwd: session.cwd,
    transcript,
    usage,
    plan,
    canPrompt:
      connection.status === "connected" && !!session.sessionId && !transcript.turnActive,
    turnActive: transcript.turnActive,
    modes: session.modes,
    permission,
    pickDirectory: session.pickDirectory,
    sendPrompt: session.sendPrompt,
    cancel: session.cancel,
    setMode: session.setMode,
    resolvePermission,
    reconnect: connection.reconnect,
  };
}
