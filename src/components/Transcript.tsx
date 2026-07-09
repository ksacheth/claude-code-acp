import { Markdown } from "./Markdown";
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
        <div key={m.id} className={`message message-${m.role}`}>
          <div className="role">{m.role}</div>
          <div className="text">
            {m.role === "assistant" ? <Markdown text={m.text} /> : m.text}
            {m.streaming && <span className="caret" />}
          </div>
        </div>
      ))}
    </section>
  );
}
