import { useState } from "react";

import { filterTree, type ChatEntry, type SidebarTree } from "../session/projects";
import { ChatRow } from "./ChatRow";
import { ProjectGroup } from "./ProjectGroup";
import { SidebarToggleButton } from "./SidebarToggleButton";

const NO_CHATS = "Start a chat and it will appear here.";

export interface SidebarProps {
  tree: SidebarTree;
  /// True until the persisted list has arrived, so an empty tree can be told
  /// apart from one that has not loaded.
  loading: boolean;
  activeId?: string;
  /// Project directories whose chats are showing.
  expanded: Set<string>;
  nowMs: number;
  disabled: boolean;
  onToggleProject: (cwd: string) => void;
  onRenameProject: (cwd: string, label: string) => void;
  onSelectChat: (chat: ChatEntry) => void;
  onRenameChat: (chat: ChatEntry, title: string) => void;
  onDeleteChat: (chat: ChatEntry) => void;
  onNewChat: () => void;
  onNewProject: () => void;
  onSettings: () => void;
  onCollapse: () => void;
}

/// Which row is being renamed. Chats and projects share the editor, so the key is
/// namespaced: chat ids and directory paths could otherwise collide.
type RenameTarget = { kind: "chat"; id: string } | { kind: "project"; cwd: string };

function isRenaming(target: RenameTarget | undefined, kind: RenameTarget["kind"], key: string) {
  if (!target || target.kind !== kind) return false;
  return target.kind === "chat" ? target.id === key : target.cwd === key;
}

/// Every chat the app knows about: the ones with no project first, flat, then one
/// collapsible group per project directory. This is the whole session browser, so
/// past conversations are visible without opening anything, and a chat loads only
/// when it is selected.
export function Sidebar({
  tree,
  loading,
  activeId,
  expanded,
  nowMs,
  disabled,
  onToggleProject,
  onRenameProject,
  onSelectChat,
  onRenameChat,
  onDeleteChat,
  onNewChat,
  onNewProject,
  onSettings,
  onCollapse,
}: SidebarProps) {
  const [query, setQuery] = useState("");
  const [renaming, setRenaming] = useState<RenameTarget>();

  const searching = query.trim().length > 0;
  const filtered = filterTree(tree, query);
  const empty = filtered.loose.length === 0 && filtered.projects.length === 0;

  const chatRow = (chat: ChatEntry) => (
    <ChatRow
      key={chat.id}
      chat={chat}
      active={chat.id === activeId}
      nowMs={nowMs}
      renaming={isRenaming(renaming, "chat", chat.id)}
      onSelect={() => onSelectChat(chat)}
      onStartRename={() => setRenaming({ kind: "chat", id: chat.id })}
      onRename={(title) => {
        setRenaming(undefined);
        onRenameChat(chat, title);
      }}
      onCancelRename={() => setRenaming(undefined)}
      onDelete={() => onDeleteChat(chat)}
    />
  );

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">C</div>
        <div className="sidebar-brand-copy">
          <div className="brand-name">Claude Workspace</div>
          <div className="brand-subtitle">Local ACP client</div>
        </div>
        <SidebarToggleButton expanded onClick={onCollapse} />
      </div>

      <div className="sidebar-actions">
        <button className="new-session" onClick={onNewChat} disabled={disabled}>
          + New chat
        </button>
        <button
          className="new-project"
          onClick={onNewProject}
          disabled={disabled}
          title="New chat in a project folder"
          aria-label="New chat in a project folder"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <path d="M12 11v5M9.5 13.5h5" />
          </svg>
        </button>
        <button className="settings-button" onClick={onSettings} title="Settings">
          Settings
        </button>
      </div>

      <input
        className="sidebar-search"
        type="search"
        value={query}
        aria-label="Search chats"
        placeholder="Search chats"
        onChange={(event) => setQuery(event.currentTarget.value)}
      />

      <div className="sidebar-scroll">
        {empty && (
          <div className="sidebar-empty">
            {loading ? "Loading chats…" : searching ? "No chats match." : NO_CHATS}
          </div>
        )}

        {filtered.loose.length > 0 && (
          <>
            <div className="sidebar-section-label">Chats</div>
            <ul className="chat-list">{filtered.loose.map(chatRow)}</ul>
          </>
        )}

        {filtered.projects.length > 0 && (
          <>
            <div className="sidebar-section-label">Projects</div>
            <ul className="project-list">
              {filtered.projects.map((project) => (
                <ProjectGroup
                  key={project.cwd}
                  project={project}
                  // A search shows its matches wherever they are; a collapsed
                  // group would hide the very rows that matched.
                  expanded={searching || expanded.has(project.cwd)}
                  renaming={isRenaming(renaming, "project", project.cwd)}
                  onToggle={() => onToggleProject(project.cwd)}
                  onStartRename={() => setRenaming({ kind: "project", cwd: project.cwd })}
                  onRename={(label) => {
                    setRenaming(undefined);
                    onRenameProject(project.cwd, label);
                  }}
                  onResetName={() => onRenameProject(project.cwd, "")}
                  onCancelRename={() => setRenaming(undefined)}
                  chats={project.chats.map(chatRow)}
                />
              ))}
            </ul>
          </>
        )}
      </div>
    </aside>
  );
}
