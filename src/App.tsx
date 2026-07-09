import "./App.css";
import { Composer } from "./components/Composer";
import { DisconnectBanner } from "./components/DisconnectBanner";
import { Header } from "./components/Header";
import { PermissionModal } from "./components/PermissionModal";
import { PlanChecklist } from "./components/PlanChecklist";
import { TranscriptView } from "./components/Transcript";
import { useAgent } from "./useAgent";

function App() {
  const agent = useAgent();
  const { status, agentInfo, error, cwd, transcript, usage } = agent;

  return (
    <main className="app">
      <Header
        status={status}
        agentInfo={agentInfo}
        usage={usage}
        modes={agent.modes}
        onSetMode={(modeId) => void agent.setMode(modeId)}
      />

      {error && <pre className="error">{error}</pre>}

      <DisconnectBanner status={status} onReconnect={() => void agent.reconnect()} />

      <TranscriptView
        messages={transcript.messages}
        showPicker={!cwd && status === "connected"}
        onPickDirectory={() => void agent.pickDirectory()}
      />

      {agent.plan && <PlanChecklist entries={agent.plan} />}

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
