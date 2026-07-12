import type {
  SessionUpdate,
  ToolCallContent,
  ToolCallStatus,
  ToolKind,
} from "@agentclientprotocol/sdk";
import type { PromptImage } from "./attachments";

export type Role = "user" | "assistant";

/// A tool call as accumulated from `tool_call` + `tool_call_update` streams.
export interface ToolCallView {
  id: string;
  title: string;
  kind: ToolKind;
  status: ToolCallStatus;
  rawInput?: unknown;
  rawOutput?: unknown;
  content: ToolCallContent[];
}

/// One ordered segment of an assistant turn. Thinking, answer text, and tool
/// calls interleave in arrival order, so the transcript renders them the way
/// the agent produced them (think → tool → think → answer) instead of grouping
/// all thinking above everything.
export type MessagePart =
  | { type: "text"; text: string }
  | { type: "image"; image: PromptImage }
  | { type: "thought"; text: string }
  | { type: "tool"; call: ToolCallView };

export interface Message {
  id: string;
  role: Role;
  /// Ordered content segments (see MessagePart). A user message is a single
  /// text part; an assistant message interleaves thought/text/tool parts.
  parts: MessagePart[];
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
  | { kind: "submit"; userId: string; assistantId: string; text: string; images?: PromptImage[] }
  /// A streaming session update arrived.
  | { kind: "update"; update: SessionUpdate }
  /// The turn finished (prompt response received or cancelled).
  | { kind: "end" };

/// Concatenated answer text of a message (all text parts, in order).
export function messageText(message: Message): string {
  return message.parts.flatMap((p) => (p.type === "text" ? [p.text] : [])).join("");
}

/// Concatenated thinking text of a message (all thought parts, in order).
export function messageThought(message: Message): string {
  return message.parts.flatMap((p) => (p.type === "thought" ? [p.text] : [])).join("");
}

/// The message's tool calls, in the order they were made.
export function toolCalls(message: Message): ToolCallView[] {
  return message.parts.flatMap((p) => (p.type === "tool" ? [p.call] : []));
}

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
    parts: [],
    streaming: true,
  };
  return { ...state, messages: [...state.messages, edit(opened)] };
}

/// Append a text/thought chunk to `parts`: extend the last part when it is the
/// same kind (a continuing run), else start a new part. This is what keeps
/// consecutive thinking one block while a following tool call or answer starts
/// a fresh segment.
function appendChunk(parts: MessagePart[], kind: "text" | "thought", chunk: string): MessagePart[] {
  const last = parts[parts.length - 1];
  if (last && last.type === kind) {
    return [...parts.slice(0, -1), { ...last, text: last.text + chunk }];
  }
  return [
    ...parts,
    kind === "text" ? { type: "text", text: chunk } : { type: "thought", text: chunk },
  ];
}

/// Replayed history includes user_message_chunk updates. A user message marks
/// the end of the preceding assistant turn, so preserve it as a real transcript
/// entry instead of letting every restored assistant reply run together.
function applyUserChunk(
  state: TranscriptState,
  update: Extract<SessionUpdate, { sessionUpdate: "user_message_chunk" }>,
): TranscriptState {
  const part: MessagePart | undefined =
    update.content.type === "text"
      ? { type: "text", text: update.content.text }
      : update.content.type === "image"
        ? {
            type: "image",
            image: {
              id: `user-image-${state.messages.length}-${update.content.data.slice(0, 12)}`,
              name: "Attached image",
              mimeType: update.content.mimeType,
              data: update.content.data,
              size: 0,
            },
          }
        : undefined;
  if (!part) return state;

  const id = update.messageId ?? `user-${state.messages.length}`;
  const last = state.messages[state.messages.length - 1];
  if (last?.role === "user" && last.id === id) {
    const parts = part.type === "text" ? appendChunk(last.parts, "text", part.text) : [...last.parts, part];
    return { ...state, messages: [...state.messages.slice(0, -1), { ...last, parts }] };
  }

  return {
    ...state,
    messages: [
      ...state.messages.map((message) =>
        message.streaming ? { ...message, streaming: false } : message,
      ),
      { id, role: "user", parts: [part], streaming: false },
    ],
  };
}

/// Route a text/thought chunk into the open assistant message as an ordered
/// part. Answer text and thinking stream the same way into different part kinds.
function applyChunk(state: TranscriptState, update: SessionUpdate): TranscriptState {
  if (update.sessionUpdate === "user_message_chunk") {
    return applyUserChunk(state, update);
  }
  const isMessage = update.sessionUpdate === "agent_message_chunk";
  const isThought = update.sessionUpdate === "agent_thought_chunk";
  if ((isMessage || isThought) && update.content.type === "text") {
    const kind = isMessage ? "text" : "thought";
    const chunk = update.content.text;
    return editOpenAssistant(state, (m) => ({ ...m, parts: appendChunk(m.parts, kind, chunk) }));
  }
  if (isMessage && update.content.type === "image") {
    const image: PromptImage = {
      id: `assistant-image-${state.messages.length}-${update.content.data.slice(0, 12)}`,
      name: "Generated image",
      mimeType: update.content.mimeType,
      data: update.content.data,
      size: 0,
    };
    return editOpenAssistant(state, (m) => ({
      ...m,
      parts: [...m.parts, { type: "image", image }],
    }));
  }
  return state;
}

/// Merge a `tool_call_update`'s defined fields onto an existing tool call.
function mergeToolCall(
  call: ToolCallView,
  update: Extract<SessionUpdate, { sessionUpdate: "tool_call_update" }>,
): ToolCallView {
  return {
    ...call,
    title: update.title ?? call.title,
    kind: update.kind ?? call.kind,
    status: update.status ?? call.status,
    rawInput: update.rawInput ?? call.rawInput,
    rawOutput: update.rawOutput ?? call.rawOutput,
    content: update.content ?? call.content,
  };
}

/// Add a new tool call (on `tool_call`) as an ordered part, or merge into the
/// existing tool part by id (on `tool_call_update`), within the open assistant
/// message. A merge updates the part in place, preserving its position.
function applyToolCall(
  state: TranscriptState,
  update: Extract<SessionUpdate, { sessionUpdate: "tool_call" | "tool_call_update" }>,
): TranscriptState {
  if (update.sessionUpdate === "tool_call") {
    const call: ToolCallView = {
      id: update.toolCallId,
      title: update.title,
      kind: update.kind ?? "other",
      status: update.status ?? "pending",
      rawInput: update.rawInput,
      rawOutput: update.rawOutput,
      content: update.content ?? [],
    };
    return editOpenAssistant(state, (m) => ({ ...m, parts: [...m.parts, { type: "tool", call }] }));
  }
  return editOpenAssistant(state, (m) => ({
    ...m,
    parts: m.parts.map((p) =>
      p.type === "tool" && p.call.id === update.toolCallId
        ? { type: "tool", call: mergeToolCall(p.call, update) }
        : p,
    ),
  }));
}

/// Assembles streaming session updates into a chat transcript. Assistant turns
/// keep their content ordered (thinking, tool calls, answer text interleaved as
/// the agent emits them); usage/mode/plan live on the session, outside here.
export function transcriptReducer(
  state: TranscriptState,
  action: TranscriptAction,
): TranscriptState {
  switch (action.kind) {
    case "submit": {
      const userParts: MessagePart[] = [];
      if (action.text) userParts.push({ type: "text", text: action.text });
      for (const image of action.images ?? []) userParts.push({ type: "image", image });
      return {
        turnActive: true,
        messages: [
          ...state.messages,
          {
            id: action.userId,
            role: "user",
            parts: userParts,
            streaming: false,
          },
          {
            id: action.assistantId,
            role: "assistant",
            parts: [],
            streaming: true,
          },
        ],
      };
    }

    case "update": {
      const update = action.update;
      if (update.sessionUpdate === "tool_call" || update.sessionUpdate === "tool_call_update") {
        return applyToolCall(state, update);
      }
      return applyChunk(state, update);
    }

    case "end":
      return {
        turnActive: false,
        messages: state.messages.map((m) => (m.streaming ? { ...m, streaming: false } : m)),
      };
  }
}
