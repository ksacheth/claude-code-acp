import { useLayoutEffect, useRef } from "react";

import { Markdown } from "./Markdown";
import { ToolCall } from "./ToolCall";
import type { Message, MessagePart } from "../session/transcript";
import { imageDataUrl } from "../session/attachments";
import { isNearBottom } from "../session/scroll";

interface TranscriptViewProps {
  /// Identifies the open session, so switching sessions snaps to its bottom
  /// even if the user had scrolled up in the previous one.
  sessionId: string;
  messages: Message[];
}

/// The scrolling message list for the active session. Auto-scrolls to follow
/// new streamed content, but only while the user is at (or near) the bottom —
/// scrolling up to reread earlier content pauses it until they scroll back
/// down, so streaming never yanks the view out from under them.
export function TranscriptView({ sessionId, messages }: TranscriptViewProps) {
  const containerRef = useRef<HTMLElement>(null);
  const stickToBottomRef = useRef(true);
  const lastSessionIdRef = useRef(sessionId);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const switchedSession = lastSessionIdRef.current !== sessionId;
    lastSessionIdRef.current = sessionId;
    if (switchedSession) stickToBottomRef.current = true;
    if (stickToBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [sessionId, messages]);

  return (
    <section
      className="transcript"
      ref={containerRef}
      onScroll={(e) => {
        stickToBottomRef.current = isNearBottom(e.currentTarget);
      }}
    >
      {messages.map((m) => (
        <MessageView key={m.id} message={m} />
      ))}
    </section>
  );
}

function MessageView({ message: m }: { message: Message }) {
  const isAssistant = m.role === "assistant";
  const lastIndex = m.parts.length - 1;
  return (
    <div className={`message message-${m.role}`}>
      <div className="role">{m.role}</div>
      {m.parts.map((part, i) => (
        <PartView
          key={i}
          part={part}
          assistant={isAssistant}
          streaming={m.streaming}
          last={i === lastIndex}
        />
      ))}
      {/* A streaming assistant that hasn't emitted any part yet still shows a
          caret so a warming-up turn reads as active. */}
      {isAssistant && m.streaming && m.parts.length === 0 && (
        <div className="text">
          <span className="caret" />
        </div>
      )}
    </div>
  );
}

interface PartViewProps {
  part: MessagePart;
  assistant: boolean;
  streaming: boolean;
  /// True for the message's final part — carries the live caret / "…".
  last: boolean;
}

/// Render one ordered content part in place: a thinking block, a tool call, or
/// answer/user text. The active caret and the thinking "…" only attach to the
/// last part of a streaming message.
function PartView({ part, assistant, streaming, last }: PartViewProps) {
  switch (part.type) {
    case "thought":
      return <ThoughtBlock thought={part.text} streaming={streaming && last} />;
    case "tool":
      return (
        <div className="toolcalls">
          <ToolCall call={part.call} />
        </div>
      );
    case "text":
      return (
        <div className="text">
          {assistant ? <Markdown text={part.text} /> : part.text}
          {assistant && streaming && last && <span className="caret" />}
        </div>
      );
    case "image":
      return (
        <a
          className="message-image"
          href={imageDataUrl(part.image)}
          target="_blank"
          rel="noreferrer"
        >
          <img src={imageDataUrl(part.image)} alt={part.image.name} />
        </a>
      );
  }
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
