import type { SessionModeId, SessionModeState } from "@agentclientprotocol/sdk";

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
  modes?: SessionModeState;
  onSetMode: (modeId: SessionModeId) => void;
}

/// The top bar: app title, mode selector, live context/cost usage, and status.
export function Header({ status, agentLabel, usage, modes, onSetMode }: HeaderProps) {
  const cost = usage && formatCost(usage.cost);
  return (
    <header className="app-header">
      <div className="title">Claude Tauri</div>
      <div className="header-right">
        {modes && modes.availableModes.length > 1 && (
          <select
            className="mode-select"
            value={modes.currentModeId}
            onChange={(e) => onSetMode(e.currentTarget.value)}
          >
            {modes.availableModes.map((mode) => (
              <option key={mode.id} value={mode.id}>
                {mode.name}
              </option>
            ))}
          </select>
        )}
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
