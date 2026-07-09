import type { PlanEntry, SessionModeState, SessionUpdate } from "@agentclientprotocol/sdk";

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
  modes?: SessionModeState;
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
  | { kind: "create"; id: string; cwd: string; modes?: SessionModeState }
  | { kind: "activate"; id: string }
  | { kind: "remove"; id: string }
  | { kind: "clear" }
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
    case "current_mode_update":
      return session.modes
        ? { ...session, modes: { ...session.modes, currentModeId: update.currentModeId } }
        : session;
    case "plan":
      return { ...session, plan: update.entries };
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
    case "create": {
      const session: SessionState = {
        id: action.id,
        cwd: action.cwd,
        title: titleFromCwd(action.cwd),
        transcript: emptyTranscript,
        modes: action.modes,
      };
      return { sessions: [...state.sessions, session], activeId: action.id };
    }
    case "activate":
      return { ...state, activeId: action.id };
    case "clear":
      return emptySessions;
    case "remove":
      return {
        sessions: state.sessions.filter((s) => s.id !== action.id),
        activeId: nextActive(state.sessions, action.id, state.activeId),
      };
    default:
      return {
        ...state,
        sessions: state.sessions.map((s) =>
          s.id === action.sessionId ? applyToSession(s, action) : s,
        ),
      };
  }
}

/// The active session, if any.
export function activeSession(state: SessionsState): SessionState | undefined {
  return state.sessions.find((s) => s.id === state.activeId);
}
