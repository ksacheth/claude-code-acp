import "./App.css";
import { useAgentConnection, type ConnectionStatus } from "./useAgentConnection";

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connecting: "Connecting to engine…",
  connected: "Connected",
  disconnected: "Disconnected",
  error: "Connection failed",
};

function App() {
  const { status, agentInfo, error } = useAgentConnection();

  return (
    <main className="container">
      <h1>Claude Tauri</h1>
      <p className={`status status-${status}`}>
        <span className="status-dot" />
        {status === "connected" && agentInfo
          ? `Connected — ${agentInfo.name} v${agentInfo.version}`
          : STATUS_LABEL[status]}
      </p>
      {error && <pre className="error">{error}</pre>}
    </main>
  );
}

export default App;
