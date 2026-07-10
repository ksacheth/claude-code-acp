import { useState } from "react";
import type { SessionInfo } from "@agentclientprotocol/sdk";

import "./App.css";
import { DisconnectBanner } from "./components/DisconnectBanner";
import { Header } from "./components/Header";
import { HistoryBrowser } from "./components/HistoryBrowser";
import { PermissionModal } from "./components/PermissionModal";
import { SettingsModal } from "./components/SettingsModal";
import { Sidebar } from "./components/Sidebar";
import { Workspace } from "./components/Workspace";
import { useAgent } from "./useAgent";

function App() {
  const agent = useAgent();
  const { status, agentInfo, error, active } = agent;
  const connected = status === "connected";

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyList, setHistoryList] = useState<SessionInfo[] | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const openHistory = () => {
    setHistoryList(null);
    setHistoryOpen(true);
    void agent.listSessions().then(setHistoryList);
  };

  return (
    <div className="app-shell">
      <Sidebar
        sessions={agent.sessions}
        activeId={agent.activeId}
        onSelect={agent.switchSession}
        onNew={() => void agent.newSession()}
        onHistory={openHistory}
        onSettings={() => setSettingsOpen(true)}
        disabled={!connected}
      />

      <main className="app">
        <Header
          status={status}
          agentInfo={agentInfo}
          usage={active?.usage}
          configOptions={active?.configOptions}
          onSetConfig={(configId, value) => void agent.setConfig(configId, value)}
        />

        {error && <pre className="error">{error}</pre>}

        <DisconnectBanner status={status} onReconnect={() => void agent.reconnect()} />

        <Workspace
          active={active}
          connected={connected}
          canPrompt={agent.canPrompt}
          onNewSession={() => void agent.newSession()}
          onSend={(text, images) => void agent.sendPrompt(text, images)}
          onCancel={() => void agent.cancel()}
        />
      </main>

      {agent.permission && (
        <PermissionModal request={agent.permission} onResolve={agent.resolvePermission} />
      )}

      {historyOpen && (
        <HistoryBrowser
          sessions={historyList}
          nowMs={Date.now()}
          onResume={(info) => {
            void agent.resumeSession(info);
            setHistoryOpen(false);
          }}
          onClose={() => setHistoryOpen(false)}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          settings={agent.settings}
          onSave={agent.saveSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
