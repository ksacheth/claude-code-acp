import { formatRelativeTime } from "../session/relativeTime";
import type { ChatEntry } from "../session/projects";
import { InlineRename } from "./InlineRename";
import { RowMenu } from "./RowMenu";

interface ChatRowProps {
  chat: ChatEntry;
  active: boolean;
  nowMs: number;
  renaming: boolean;
  onSelect: () => void;
  onStartRename: () => void;
  onRename: (title: string) => void;
  onCancelRename: () => void;
  onDelete: () => void;
}

/// One chat in the sidebar: its title, how long ago it was touched, and a dot
/// while its turn streams. Clicking it shows the conversation, loading it first
/// if this run has not yet.
export function ChatRow({
  chat,
  active,
  nowMs,
  renaming,
  onSelect,
  onStartRename,
  onRename,
  onCancelRename,
  onDelete,
}: ChatRowProps) {
  return (
    <li className={`chat-item${active ? " active" : ""}`}>
      {renaming ? (
        <InlineRename
          initial={chat.title}
          label={`Rename ${chat.title}`}
          onCommit={onRename}
          onCancel={onCancelRename}
        />
      ) : (
        <>
          <button type="button" className="chat-open" onClick={onSelect} title={chat.title}>
            <span className="chat-title">{chat.title}</span>
            {chat.streaming && <span className="session-spinner" />}
            {chat.updatedAt && !chat.streaming && (
              <span className="chat-time">{formatRelativeTime(chat.updatedAt, nowMs)}</span>
            )}
          </button>
          <RowMenu
            label={`Options for ${chat.title}`}
            items={[
              { label: "Rename", onSelect: onStartRename },
              { label: "Delete", onSelect: onDelete, danger: true },
            ]}
          />
        </>
      )}
    </li>
  );
}
