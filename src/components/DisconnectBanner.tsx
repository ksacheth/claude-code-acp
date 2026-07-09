import type { ConnectionStatus } from "../useAgent";

interface DisconnectBannerProps {
  status: ConnectionStatus;
  onReconnect: () => void;
}

/// Shown when the engine is disconnected or failed to start, offering a retry.
/// Renders nothing when connected/connecting.
export function DisconnectBanner({ status, onReconnect }: DisconnectBannerProps) {
  if (status !== "disconnected" && status !== "error") return null;
  return (
    <div className="banner">
      <span>{status === "error" ? "Engine failed to start." : "Engine disconnected."}</span>
      <button onClick={onReconnect}>Reconnect</button>
    </div>
  );
}
