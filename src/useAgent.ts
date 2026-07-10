import { useCallback, useReducer, useRef, useState } from "react";

import { useOpenSessionsPersistence } from "./session/useOpenSessionsPersistence";
import type {
  ClientContext,
  RequestPermissionRequest,
  RequestPermissionResponse,
  SessionInfo,
  SessionNotification,
} from "@agentclientprotocol/sdk";

import {
  useAgentConnection,
  type AgentConnectionHandle,
  type ConnectionStatus,
} from "./acp/useAgentConnection";
import { useSessionActions } from "./session/useSessionActions";
import { useSessionHistory } from "./session/useSessionHistory";
import { useSettings } from "./session/useSettings";
import type { Settings } from "./session/settings";
import type { PromptImage } from "./session/attachments";
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
  sendPrompt: (text: string, images?: PromptImage[]) => Promise<void>;
  cancel: () => Promise<void>;
  setConfig: (configId: string, value: string) => Promise<void>;
  listSessions: () => Promise<SessionInfo[]>;
  resumeSession: (info: SessionInfo) => Promise<void>;
  resolvePermission: (response: RequestPermissionResponse) => void;
  reconnect: () => Promise<void>;
  /// Persisted app settings and a setter (used by the settings UI).
  settings: Settings;
  saveSettings: (next: Settings) => void;
}

/// Composes the (session-agnostic) connection with the multi-session store. The
/// `ctxRef` is shared: the connection writes it, session actions read it.
export function useAgent(): AgentState {
  const ctxRef = useRef<ClientContext | null>(null);
  const { settings, save: saveSettings } = useSettings();
  // Shared like ctxRef: sub-hooks read the latest settings at action time, so
  // edits apply to the next session / reconnect without re-render churn.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
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

  // onReset runs before a reconnect clears the store; it also tells the
  // persistence layer to drop hydration (via a ref, since that callback is
  // created below). Stable so the connection isn't torn down on every render.
  const notifyResetRef = useRef<() => void>(() => {});
  const onReset = useCallback(() => {
    notifyResetRef.current();
    dispatch({ kind: "clear" });
  }, []);

  const openIds = sessions.sessions.map((s) => s.id);
  const actions = useSessionActions(ctxRef, dispatch, sessions.activeId, settingsRef);
  const history = useSessionHistory(ctxRef, dispatch, openIds, settingsRef);
  const connection = useAgentConnection(ctxRef, settingsRef, {
    onUpdate,
    onPermissionRequest,
    onReset,
  });

  notifyResetRef.current = useOpenSessionsPersistence(
    connection.status,
    sessions.sessions,
    sessions.activeId,
    history.restoreSessions,
  );

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
    setConfig: actions.setConfig,
    listSessions: history.listSessions,
    resumeSession: history.resumeSession,
    resolvePermission,
    reconnect: connection.reconnect,
    settings,
    saveSettings,
  };
}
