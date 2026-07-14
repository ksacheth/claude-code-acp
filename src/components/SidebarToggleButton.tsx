interface SidebarToggleButtonProps {
  expanded: boolean;
  onClick: () => void;
}

export function SidebarToggleButton({ expanded, onClick }: SidebarToggleButtonProps) {
  const label = expanded ? "Hide sidebar" : "Show sidebar";
  return (
    <button
      type="button"
      className="sidebar-toggle-button"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M9 4v16" />
        {expanded ? <path d="m15 9-3 3 3 3" /> : <path d="m13 9 3 3-3 3" />}
      </svg>
    </button>
  );
}
