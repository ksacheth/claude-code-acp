import type { SessionUpdate } from "@agentclientprotocol/sdk";

export type Role = "user" | "assistant";

export interface Message {
  id: string;
  role: Role;
  text: string;
  /// True while the assistant message is still receiving chunks.
  streaming: boolean;
}

export interface TranscriptState {
  messages: Message[];
  /// True between submitting a prompt and the turn ending.
  turnActive: boolean;
}

export const emptyTranscript: TranscriptState = { messages: [], turnActive: false };

export type TranscriptAction =
  /// User sent a prompt: append their message and open an empty assistant message.
  | { kind: "submit"; userId: string; assistantId: string; text: string }
  /// A streaming session update arrived.
  | { kind: "update"; update: SessionUpdate }
  /// The turn finished (prompt response received or cancelled).
  | { kind: "end" };

function appendToOpenAssistant(state: TranscriptState, text: string): TranscriptState {
  const last = state.messages[state.messages.length - 1];
  if (last && last.role === "assistant" && last.streaming) {
    const updated = { ...last, text: last.text + text };
    return { ...state, messages: [...state.messages.slice(0, -1), updated] };
  }
  // Defensive: a chunk with no open assistant message (e.g. resumed mid-turn).
  return {
    ...state,
    messages: [
      ...state.messages,
      { id: `assistant-${state.messages.length}`, role: "assistant", text, streaming: true },
    ],
  };
}

/// Assembles streaming session updates into a chat transcript.
///
/// M0 renders assistant text only. Thought chunks, tool calls, plans, and usage
/// are intentionally ignored here and surface in later milestones (M1/M2).
export function transcriptReducer(
  state: TranscriptState,
  action: TranscriptAction,
): TranscriptState {
  switch (action.kind) {
    case "submit":
      return {
        turnActive: true,
        messages: [
          ...state.messages,
          { id: action.userId, role: "user", text: action.text, streaming: false },
          { id: action.assistantId, role: "assistant", text: "", streaming: true },
        ],
      };

    case "update": {
      const update = action.update;
      if (update.sessionUpdate === "agent_message_chunk" && update.content.type === "text") {
        return appendToOpenAssistant(state, update.content.text);
      }
      return state;
    }

    case "end":
      return {
        turnActive: false,
        messages: state.messages.map((m) => (m.streaming ? { ...m, streaming: false } : m)),
      };
  }
}
