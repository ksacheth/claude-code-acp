import type { SessionConfigOption } from "@agentclientprotocol/sdk";

import { selectConfigs } from "../session/config";
import { formatContext, formatCost, formatRateLimit, type Usage } from "../session/usage";
import type { ConnectionStatus } from "../useAgent";

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connecting: "Connecting to engine…",
  connected: "Connected",
  disconnected: "Disconnected",
  error: "Connection failed",
};

interface HeaderProps {
  status: ConnectionStatus;
  agentInfo?: { name: string; version: string } | null;
  usage?: Usage;
  configOptions?: SessionConfigOption[];
  onSetConfig: (configId: string, value: string) => void;
}

/// The top bar: app title, session config selectors (mode/model/effort/agent),
/// live context/cost usage, and connection status.
export function Header({ status, agentInfo, usage, configOptions, onSetConfig }: HeaderProps) {
  const cost = usage && formatCost(usage.cost);
  const agentLabel = agentInfo ? `${agentInfo.name} v${agentInfo.version}` : undefined;
  return (
    <header className="app-header">
      <div className="header-title-group">
        <div className="title">Workspace</div>
        <div className="header-subtitle">Your local Claude sessions</div>
      </div>
      <div className="header-right">
        {selectConfigs(configOptions).map((config) => (
          <select
            key={config.id}
            className={`config-select config-${config.id}`}
            title={config.name}
            aria-label={config.name}
            value={config.currentValue}
            onChange={(e) => onSetConfig(config.id, e.currentTarget.value)}
          >
            {config.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.name}
              </option>
            ))}
          </select>
        ))}
        {usage && (
          <div className="usage" title="Context tokens used / window (·cost)">
            {formatContext(usage)}
            {cost && <span className="cost"> · {cost}</span>}
          </div>
        )}
        {usage?.rateLimits?.map((limit) => (
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
