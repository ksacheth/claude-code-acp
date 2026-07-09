import "./App.css";
import { DisconnectBanner } from "./components/DisconnectBanner";
import { Header } from "./components/Header";
import { PermissionModal } from "./components/PermissionModal";
import { Sidebar } from "./components/Sidebar";
import { Workspace } from "./components/Workspace";
import { useAgent } from "./useAgent";

function App() {
  const agent = useAgent();
  const { status, agentInfo, error, active } = agent;
  const connected = status === "connected";

  return (
    <div className="app-shell">
      <Sidebar
        sessions={agent.sessions}
        activeId={agent.activeId}
        onSelect={agent.switchSession}
        onNew={() => void agent.newSession()}
        disabled={!connected}
      />

      <main className="app">
        <Header
          status={status}
          agentInfo={agentInfo}
          usage={active?.usage}
          modes={active?.modes}
          onSetMode={(modeId) => void agent.setMode(modeId)}
        />

        {error && <pre className="error">{error}</pre>}

        <DisconnectBanner status={status} onReconnect={() => void agent.reconnect()} />

        <Workspace
          active={active}
          connected={connected}
          canPrompt={agent.canPrompt}
          onNewSession={() => void agent.newSession()}
          onSend={(text) => void agent.sendPrompt(text)}
          onCancel={() => void agent.cancel()}
        />
      </main>

      {agent.permission && (
        <PermissionModal request={agent.permission} onResolve={agent.resolvePermission} />
      )}
    </div>
  );
}

export default App;
