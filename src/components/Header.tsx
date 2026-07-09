import { formatContext, formatCost, type Usage } from "../session/usage";
import type { ConnectionStatus } from "../useAgent";

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connecting: "Connecting to engine…",
  connected: "Connected",
  disconnected: "Disconnected",
  error: "Connection failed",
};

interface HeaderProps {
  status: ConnectionStatus;
  agentLabel?: string;
  usage?: Usage;
}

/// The top bar: app title, live context/cost usage, and connection status.
export function Header({ status, agentLabel, usage }: HeaderProps) {
  const cost = usage && formatCost(usage.cost);
  return (
    <header className="app-header">
      <div className="title">Claude Tauri</div>
      <div className="header-right">
        {usage && (
          <div className="usage" title="Context tokens used / window (·cost)">
            {formatContext(usage)}
            {cost && <span className="cost"> · {cost}</span>}
          </div>
        )}
        <div className={`status status-${status}`}>
          <span className="status-dot" />
          {status === "connected" && agentLabel ? agentLabel : STATUS_LABEL[status]}
        </div>
      </div>
    </header>
  );
}
