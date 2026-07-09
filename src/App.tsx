import "./App.css";
import { Composer } from "./components/Composer";
import { Header } from "./components/Header";
import { PermissionModal } from "./components/PermissionModal";
import { TranscriptView } from "./components/Transcript";
import { useAgent } from "./useAgent";

function App() {
  const agent = useAgent();
  const { status, agentInfo, error, cwd, transcript, usage } = agent;
  const offline = status === "disconnected" || status === "error";

  return (
    <main className="app">
      <Header
        status={status}
        agentLabel={agentInfo ? `${agentInfo.name} v${agentInfo.version}` : undefined}
        usage={usage}
        modes={agent.modes}
        onSetMode={(modeId) => void agent.setMode(modeId)}
      />

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
          onCancel={() => void agent.cancel()}
        />
      )}

      {agent.permission && (
        <PermissionModal request={agent.permission} onResolve={agent.resolvePermission} />
      )}
    </main>
  );
}

export default App;
