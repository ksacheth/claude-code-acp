import { useCallback, useReducer, useRef, useState } from "react";

import type {
  ClientContext,
  RequestPermissionRequest,
  RequestPermissionResponse,
  SessionInfo,
  SessionModeId,
  SessionNotification,
} from "@agentclientprotocol/sdk";

import {
  useAgentConnection,
  type AgentConnectionHandle,
  type ConnectionStatus,
} from "./acp/useAgentConnection";
import { useSessionActions } from "./session/useSessionActions";
import { useSessionHistory } from "./session/useSessionHistory";
import {
  activeSession,
  emptySessions,
  sessionsReducer,
  type SessionState,
} from "./session/sessions";

export type { ConnectionStatus };
export type { SessionState };

export interface AgentState {
  status: ConnectionStatus;
  agentInfo?: AgentConnectionHandle["agentInfo"];
  error?: string;
  /// All open sessions, in creation order.
  sessions: SessionState[];
  /// The active session, if one is selected.
  active?: SessionState;
  activeId?: string;
  /// True while a session exists and its turn is idle.
  canPrompt: boolean;
  /// A permission request awaiting the user's decision, if any.
  permission?: RequestPermissionRequest;
  newSession: () => Promise<void>;
  switchSession: (id: string) => void;
  sendPrompt: (text: string) => Promise<void>;
  cancel: () => Promise<void>;
  setMode: (modeId: SessionModeId) => Promise<void>;
  listSessions: () => Promise<SessionInfo[]>;
  resumeSession: (info: SessionInfo) => Promise<void>;
  resolvePermission: (response: RequestPermissionResponse) => void;
  reconnect: () => Promise<void>;
}

/// Composes the (session-agnostic) connection with the multi-session store. The
/// `ctxRef` is shared: the connection writes it, session actions read it.
export function useAgent(): AgentState {
  const ctxRef = useRef<ClientContext | null>(null);
  const [sessions, dispatch] = useReducer(sessionsReducer, emptySessions);
  const [permission, setPermission] = useState<RequestPermissionRequest>();
  // The pending resolver is held in a ref so resolving is a plain side effect.
  const resolverRef = useRef<((response: RequestPermissionResponse) => void) | null>(null);

  const onUpdate = useCallback((notification: SessionNotification) => {
    dispatch({ kind: "update", sessionId: notification.sessionId, update: notification.update });
  }, []);

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

  const onReset = useCallback(() => dispatch({ kind: "clear" }), []);

  const openIds = sessions.sessions.map((s) => s.id);
  const actions = useSessionActions(ctxRef, dispatch, sessions.activeId);
  const history = useSessionHistory(ctxRef, dispatch, openIds);
  const connection = useAgentConnection(ctxRef, onUpdate, onPermissionRequest, onReset);

  const active = activeSession(sessions);

  return {
    status: connection.status,
    agentInfo: connection.agentInfo,
    error: connection.error,
    sessions: sessions.sessions,
    active,
    activeId: sessions.activeId,
    canPrompt: connection.status === "connected" && !!active && !active.transcript.turnActive,
    permission,
    newSession: actions.newSession,
    switchSession: actions.switchSession,
    sendPrompt: actions.sendPrompt,
    cancel: actions.cancel,
    setMode: actions.setMode,
    listSessions: history.listSessions,
    resumeSession: history.resumeSession,
    resolvePermission,
    reconnect: connection.reconnect,
  };
}
