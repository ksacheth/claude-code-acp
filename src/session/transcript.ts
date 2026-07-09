import type { SessionUpdate } from "@agentclientprotocol/sdk";

export type Role = "user" | "assistant";

export interface Message {
  id: string;
  role: Role;
  /// The visible answer text (markdown for assistant messages).
  text: string;
  /// Accumulated extended-thinking text for assistant messages ("" if none).
  thought: string;
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

function isStreamingAssistant(message: Message | undefined): message is Message {
  return !!message && message.role === "assistant" && message.streaming;
}

/// Apply `edit` to the open (streaming) assistant message, or open a new one if
/// none is streaming (defensive: e.g. chunks arriving after a resume).
function editOpenAssistant(
  state: TranscriptState,
  edit: (message: Message) => Message,
): TranscriptState {
  const last = state.messages[state.messages.length - 1];
  if (isStreamingAssistant(last)) {
    return { ...state, messages: [...state.messages.slice(0, -1), edit(last)] };
  }
  const opened: Message = {
    id: `assistant-${state.messages.length}`,
    role: "assistant",
    text: "",
    thought: "",
    streaming: true,
  };
  return { ...state, messages: [...state.messages, edit(opened)] };
}

/// Route a streaming update into the open assistant message. Answer text and
/// thinking text stream the same way into different fields; everything else
/// (tool calls, plans, usage) is handled outside the transcript.
function applyChunk(state: TranscriptState, update: SessionUpdate): TranscriptState {
  const isMessage = update.sessionUpdate === "agent_message_chunk";
  const isThought = update.sessionUpdate === "agent_thought_chunk";
  if ((isMessage || isThought) && update.content.type === "text") {
    const chunk = update.content.text;
    const field = isMessage ? "text" : "thought";
    return editOpenAssistant(state, (m) => ({ ...m, [field]: m[field] + chunk }));
  }
  return state;
}

/// Assembles streaming session updates into a chat transcript.
///
/// M1 renders assistant answer text plus extended-thinking text. Tool calls,
/// plans, and usage are handled outside the transcript (usage lives on the
/// session; tool calls arrive in M2).
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
          { id: action.userId, role: "user", text: action.text, thought: "", streaming: false },
          { id: action.assistantId, role: "assistant", text: "", thought: "", streaming: true },
        ],
      };

    case "update":
      return applyChunk(state, action.update);

    case "end":
      return {
        turnActive: false,
        messages: state.messages.map((m) => (m.streaming ? { ...m, streaming: false } : m)),
      };
  }
}
