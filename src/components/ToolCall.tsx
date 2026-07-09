import type { ToolCallContent, ToolKind } from "@agentclientprotocol/sdk";

import type { ToolCallView } from "../session/transcript";
import { DiffView } from "./DiffView";

const KIND_ICON: Record<ToolKind, string> = {
  read: "📖",
  edit: "✏️",
  delete: "🗑️",
  move: "➡️",
  search: "🔍",
  execute: "⚡",
  think: "💭",
  fetch: "🌐",
  switch_mode: "🔁",
  other: "🔧",
};

/// One tool call: a header (icon, title, status) and a collapsible body with its
/// content — text, diffs, terminals — plus raw input/output.
export function ToolCall({ call }: { call: ToolCallView }) {
  return (
    <details className="toolcall" open={call.status === "failed"}>
      <summary>
        <span className="tool-icon">{KIND_ICON[call.kind]}</span>
        <span className="tool-title">{call.title}</span>
        <span className={`tool-status tool-${call.status}`}>{call.status}</span>
      </summary>
      <div className="tool-body">
        {call.content.map((item, i) => (
          <ToolContent key={i} content={item} />
        ))}
        {call.rawInput !== undefined && <RawBlock label="input" value={call.rawInput} />}
        {call.rawOutput !== undefined && <RawBlock label="output" value={call.rawOutput} />}
      </div>
    </details>
  );
}

function ToolContent({ content }: { content: ToolCallContent }) {
  if (content.type === "diff") {
    return <DiffView path={content.path} oldText={content.oldText} newText={content.newText} />;
  }
  if (content.type === "terminal") {
    return <div className="tool-terminal">[terminal {content.terminalId}]</div>;
  }
  // type: "content" — a content block; render text, else note the type.
  if (content.content.type === "text") {
    return <pre className="tool-text">{content.content.text}</pre>;
  }
  return <div className="tool-text muted">[{content.content.type} content]</div>;
}

function RawBlock({ label, value }: { label: string; value: unknown }) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return (
    <details className="tool-raw">
      <summary>{label}</summary>
      <pre>{text}</pre>
    </details>
  );
}
