import { useState } from "react";

import { filterTree, visibleTree, type ChatEntry, type SidebarTree } from "../session/projects";
import { ChatRow } from "./ChatRow";
import { ProjectGroup } from "./ProjectGroup";
import { SidebarHeader } from "./SidebarHeader";

/// What to say when no rows are showing. "No chats" and "not loaded yet" and
/// "nothing matched your search" are three different situations.
export function emptyMessage(loading: boolean, searching: boolean): string {
  if (loading) return "Loading chats…";
  if (searching) return "No chats match.";
  return "Start a chat and it will appear here.";
}

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
  onToggleProjectHidden: (cwd: string) => void;
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
  onToggleProjectHidden,
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
  // Revealing hidden projects is a temporary peek, not a saved preference.
  const [showHidden, setShowHidden] = useState(false);

  const searching = query.trim().length > 0;
  // Hide before filtering, so the count does not shift as the query is typed.
  const visible = visibleTree(tree, showHidden, activeId);
  const anyHidden = tree.projects.some((project) => project.hidden);
  const hiddenCount = tree.projects.length - visible.projects.length;
  const filtered = filterTree(visible, query);
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
      <SidebarHeader
        query={query}
        disabled={disabled}
        onQueryChange={setQuery}
        onNewChat={onNewChat}
        onNewProject={onNewProject}
        onSettings={onSettings}
        onCollapse={onCollapse}
      />

      <div className="sidebar-scroll">
        {empty && <div className="sidebar-empty">{emptyMessage(loading, searching)}</div>}

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
                  onToggleHidden={() => onToggleProjectHidden(project.cwd)}
                  chats={project.chats.map(chatRow)}
                />
              ))}
            </ul>
          </>
        )}

        {anyHidden && (
          <button
            type="button"
            className="show-hidden"
            onClick={() => setShowHidden((shown) => !shown)}
          >
            {showHidden ? "Hide hidden projects" : `Show ${hiddenCount} hidden`}
          </button>
        )}
      </div>
    </aside>
  );
}
