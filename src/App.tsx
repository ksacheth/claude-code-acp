import "./App.css";
import { Composer } from "./components/Composer";
import { TranscriptView } from "./components/Transcript";
import { useAgent, type ConnectionStatus } from "./useAgent";

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connecting: "Connecting to engine…",
  connected: "Connected",
  disconnected: "Disconnected",
  error: "Connection failed",
};

function App() {
  const agent = useAgent();
  const { status, agentInfo, error, cwd, transcript } = agent;
  const offline = status === "disconnected" || status === "error";

  return (
    <main className="app">
      <header className="app-header">
        <div className="title">Claude Tauri</div>
        <div className={`status status-${status}`}>
          <span className="status-dot" />
          {status === "connected" && agentInfo
            ? `${agentInfo.name} v${agentInfo.version}`
            : STATUS_LABEL[status]}
        </div>
      </header>

      {error && <pre className="error">{error}</pre>}

      {offline && (
        <div className="banner">
          <span>{status === "error" ? "Engine failed to start." : "Engine disconnected."}</span>
          <button onClick={() => void agent.reconnect()}>Reconnect</button>
        </div>
      )}

      <TranscriptView
        messages={transcript.messages}
        showPicker={!cwd && status === "connected"}
        onPickDirectory={() => void agent.pickDirectory()}
      />

      {cwd && (
        <Composer
          cwd={cwd}
          disabled={status !== "connected"}
          canSend={agent.canPrompt}
          busy={transcript.turnActive}
          onSend={(text) => void agent.sendPrompt(text)}
        />
      )}
    </main>
  );
}

export default App;
