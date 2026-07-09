import type {
  AvailableCommand,
  PlanEntry,
  SessionConfigOption,
  SessionUpdate,
} from "@agentclientprotocol/sdk";

import { patchCurrentValue, MODE_CONFIG_ID } from "./config";
import {
  emptyTranscript,
  transcriptReducer,
  type TranscriptState,
} from "./transcript";
import type { Usage } from "./usage";

/// All state for one session (bound to a project directory).
export interface SessionState {
  id: string;
  cwd: string;
  /// Display label — the cwd's basename.
  title: string;
  transcript: TranscriptState;
  usage?: Usage;
  /// Unified session config (mode/model/effort/agent/fast) from the engine.
  configOptions?: SessionConfigOption[];
  /// Agent slash commands (from available_commands_update).
  commands?: AvailableCommand[];
  plan?: PlanEntry[];
}

export interface SessionsState {
  /// Sessions in creation order.
  sessions: SessionState[];
  /// The session currently shown, if any.
  activeId?: string;
}

export const emptySessions: SessionsState = { sessions: [] };

export type SessionsAction =
  | { kind: "create"; id: string; cwd: string; configOptions?: SessionConfigOption[] }
  | { kind: "activate"; id: string }
  | { kind: "remove"; id: string }
  | { kind: "clear" }
  /// Authoritative replace (session/new, load, or set_config_option response).
  | { kind: "setConfig"; sessionId: string; configOptions: SessionConfigOption[] }
  /// Optimistic single-value patch before the set_config_option response lands.
  | { kind: "patchConfig"; sessionId: string; configId: string; value: string }
  | { kind: "submit"; sessionId: string; userId: string; assistantId: string; text: string }
  | { kind: "end"; sessionId: string }
  | { kind: "update"; sessionId: string; update: SessionUpdate };

/// The cwd's final path segment, used as the session's display title.
export function titleFromCwd(cwd: string): string {
  const segments = cwd.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? cwd;
}

/// Route one streaming update into a single session: usage/mode/plan update the
/// session's fields, everything else (chunks, tool calls) goes to its transcript.
function applyUpdate(session: SessionState, update: SessionUpdate): SessionState {
  switch (update.sessionUpdate) {
    case "usage_update":
      return { ...session, usage: { used: update.used, size: update.size, cost: update.cost } };
    case "config_option_update":
      return { ...session, configOptions: update.configOptions ?? session.configOptions };
    case "current_mode_update":
      // The engine still announces mode changes here (e.g. auto plan mode); keep
      // the mode config option's currentValue in sync.
      return { ...session, configOptions: patchCurrentValue(session.configOptions, MODE_CONFIG_ID, update.currentModeId) };
    case "available_commands_update":
      return { ...session, commands: update.availableCommands };
    case "plan":
      return { ...session, plan: update.entries };
    case "session_info_update":
      return update.title ? { ...session, title: update.title } : session;
    default:
      return { ...session, transcript: transcriptReducer(session.transcript, { kind: "update", update }) };
  }
}

/// Apply a session-scoped action to one session.
function applyToSession(session: SessionState, action: SessionsAction): SessionState {
  switch (action.kind) {
    case "submit":
      return {
        ...session,
        transcript: transcriptReducer(session.transcript, {
          kind: "submit",
          userId: action.userId,
          assistantId: action.assistantId,
          text: action.text,
        }),
      };
    case "end":
      return { ...session, transcript: transcriptReducer(session.transcript, { kind: "end" }) };
    case "update":
      return applyUpdate(session, action.update);
    default:
      return session;
  }
}

/// Add a new session (made active). Idempotent: re-creating an already-open
/// session just activates it (never blanks its transcript — matters on resume).
function createSession(
  state: SessionsState,
  id: string,
  cwd: string,
  configOptions?: SessionConfigOption[],
): SessionsState {
  if (state.sessions.some((s) => s.id === id)) {
    return { ...state, activeId: id };
  }
  const session: SessionState = {
    id,
    cwd,
    title: titleFromCwd(cwd),
    transcript: emptyTranscript,
    configOptions,
  };
  return { sessions: [...state.sessions, session], activeId: id };
}

/// Apply `edit` to the session with `id`, leaving the rest (and activeId) as-is.
function mapSession(
  state: SessionsState,
  id: string,
  edit: (session: SessionState) => SessionState,
): SessionsState {
  return { ...state, sessions: state.sessions.map((s) => (s.id === id ? edit(s) : s)) };
}

/// Pick the next active session after `removedId` leaves (the last remaining).
function nextActive(sessions: SessionState[], removedId: string, activeId?: string): string | undefined {
  if (activeId !== removedId) return activeId;
  const remaining = sessions.filter((s) => s.id !== removedId);
  return remaining.length ? remaining[remaining.length - 1].id : undefined;
}

/// Store of all sessions. Session-scoped actions carry a `sessionId` and only
/// touch that session, so concurrent turns in different sessions stay isolated.
export function sessionsReducer(state: SessionsState, action: SessionsAction): SessionsState {
  switch (action.kind) {
    case "create":
      return createSession(state, action.id, action.cwd, action.configOptions);
    case "activate":
      return { ...state, activeId: action.id };
    case "clear":
      return emptySessions;
    case "setConfig":
      return mapSession(state, action.sessionId, (s) => ({ ...s, configOptions: action.configOptions }));
    case "patchConfig":
      return mapSession(state, action.sessionId, (s) => ({
        ...s,
        configOptions: patchCurrentValue(s.configOptions, action.configId, action.value),
      }));
    case "remove":
      return {
        sessions: state.sessions.filter((s) => s.id !== action.id),
        activeId: nextActive(state.sessions, action.id, state.activeId),
      };
    default:
      return mapSession(state, action.sessionId, (s) => applyToSession(s, action));
  }
}

/// The active session, if any.
export function activeSession(state: SessionsState): SessionState | undefined {
  return state.sessions.find((s) => s.id === state.activeId);
}
