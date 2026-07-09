import { Markdown } from "./Markdown";
import { ToolCall } from "./ToolCall";
import type { Message } from "../session/transcript";

interface TranscriptViewProps {
  messages: Message[];
  showPicker: boolean;
  onPickDirectory: () => void;
}

/// The scrolling message list, with the initial directory-picker prompt shown
/// until a session exists.
export function TranscriptView({ messages, showPicker, onPickDirectory }: TranscriptViewProps) {
  return (
    <section className="transcript">
      {showPicker && (
        <div className="empty">
          <p>Choose a project directory to start a session.</p>
          <button onClick={onPickDirectory}>Choose directory…</button>
        </div>
      )}
      {messages.map((m) => (
        <MessageView key={m.id} message={m} />
      ))}
    </section>
  );
}

function MessageView({ message: m }: { message: Message }) {
  const isAssistant = m.role === "assistant";
  // Show the text row for any user message, and for an assistant message that
  // has text or is still streaming (so a warming-up turn shows a caret).
  const showText = !isAssistant || m.text.length > 0 || m.streaming;

  return (
    <div className={`message message-${m.role}`}>
      <div className="role">{m.role}</div>
      {m.thought && <ThoughtBlock thought={m.thought} streaming={m.streaming} />}
      {m.toolCalls.length > 0 && (
        <div className="toolcalls">
          {m.toolCalls.map((call) => (
            <ToolCall key={call.id} call={call} />
          ))}
        </div>
      )}
      {showText && (
        <div className="text">
          {isAssistant ? <Markdown text={m.text} /> : m.text}
          {isAssistant && m.streaming && <span className="caret" />}
        </div>
      )}
    </div>
  );
}

/// Extended-thinking text, shown in a collapsible block that is expanded by
/// default (the whole point of the app: this is hidden in Claude Desktop).
function ThoughtBlock({ thought, streaming }: { thought: string; streaming: boolean }) {
  return (
    <details className="thought" open>
      <summary>Thinking{streaming ? "…" : ""}</summary>
      <div className="thought-body">{thought}</div>
    </details>
  );
}
