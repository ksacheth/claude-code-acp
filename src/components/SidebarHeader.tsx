import { SidebarToggleButton } from "./SidebarToggleButton";

interface SidebarHeaderProps {
  query: string;
  disabled: boolean;
  onQueryChange: (query: string) => void;
  onNewChat: () => void;
  onNewProject: () => void;
  onSettings: () => void;
  onCollapse: () => void;
}

/// The sidebar's fixed top: brand, the two ways to start a chat, settings, and
/// the search field. Everything here stays put while the tree below scrolls.
///
/// "New chat" needs no directory (it uses the chats folder); the folder button is
/// for starting one in a project, which is the case that opens a picker.
export function SidebarHeader({
  query,
  disabled,
  onQueryChange,
  onNewChat,
  onNewProject,
  onSettings,
  onCollapse,
}: SidebarHeaderProps) {
  return (
    <>
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
        onChange={(event) => onQueryChange(event.currentTarget.value)}
      />
    </>
  );
}
