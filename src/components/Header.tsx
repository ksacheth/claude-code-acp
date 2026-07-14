import { formatRateLimit, type SubscriptionUsageLimit } from "../session/usage";
import type { ConnectionStatus } from "../useAgent";
import { SidebarToggleButton } from "./SidebarToggleButton";

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connecting: "Connecting to engine…",
  connected: "Connected",
  disconnected: "Disconnected",
  error: "Connection failed",
};

interface HeaderProps {
  status: ConnectionStatus;
  agentInfo?: { name: string; version: string } | null;
  rateLimits?: SubscriptionUsageLimit[];
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

/// The top bar: app title, subscription limits and connection status. Session
/// controls live beside the composer where they are available while prompting.
export function Header({
  status,
  agentInfo,
  rateLimits,
  sidebarOpen,
  onToggleSidebar,
}: HeaderProps) {
  const agentLabel = agentInfo ? `${agentInfo.name} v${agentInfo.version}` : undefined;
  return (
    <header className="app-header">
      <div className="header-left">
        {!sidebarOpen && <SidebarToggleButton expanded={false} onClick={onToggleSidebar} />}
        <div className="header-title-group">
          <div className="title">Workspace</div>
          <div className="header-subtitle">Your local Claude sessions</div>
        </div>
      </div>
      <div className="header-right">
        {rateLimits?.map((limit) => (
          <div
            key={limit.type ?? "current"}
            className={`usage usage-limit usage-limit-${limit.status}`}
            title="Claude subscription usage limit"
          >
            {formatRateLimit(limit)}
          </div>
        ))}
        <div className={`status status-${status}`}>
          <span className="status-dot" />
          {status === "connected" && agentLabel ? agentLabel : STATUS_LABEL[status]}
        </div>
      </div>
    </header>
  );
}
