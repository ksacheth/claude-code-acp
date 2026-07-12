import { useState } from "react";
import type { SessionInfo } from "@agentclientprotocol/sdk";

import "./App.css";
import { AuthBanner } from "./components/AuthBanner";
import { DisconnectBanner } from "./components/DisconnectBanner";
import { Header } from "./components/Header";
import { HistoryBrowser } from "./components/HistoryBrowser";
import { PermissionModal } from "./components/PermissionModal";
import { SettingsModal } from "./components/SettingsModal";
import { Sidebar } from "./components/Sidebar";
import { UpdatePrompt } from "./components/UpdatePrompt";
import { Workspace } from "./components/Workspace";
import { useTheme } from "./session/theme";
import { messageText } from "./session/transcript";
import { useAgent } from "./useAgent";
import { useUpdater } from "./useUpdater";

function App() {
  const agent = useAgent();
  const { status, agentInfo, error, active } = agent;
  const connected = status === "connected";
  useTheme(agent.settings.theme);
  const updater = useUpdater();

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyList, setHistoryList] = useState<SessionInfo[] | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const openHistory = () => {
    setHistoryList(null);
    setHistoryOpen(true);
    void agent.listSessions().then(setHistoryList);
  };
  const needsLogin =
    active?.transcript.messages.some(
      (message) =>
        message.role === "assistant" && /not logged in|please run \/login/i.test(messageText(message)),
    ) ?? false;

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
        <AuthBanner
          visible={needsLogin || agent.loggingIn || !!agent.loginError}
          loggingIn={agent.loggingIn}
          error={agent.loginError}
          onLogin={() => void agent.login()}
        />

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
          onDelete={(info) => {
            void agent.deleteSession(info).then(() => {
              setHistoryList((sessions) => sessions?.filter((session) => session.sessionId !== info.sessionId) ?? null);
            });
          }}
          onClose={() => setHistoryOpen(false)}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          settings={agent.settings}
          onSave={agent.saveSettings}
          onClose={() => setSettingsOpen(false)}
          onCheckForUpdates={() => void updater.checkForUpdates()}
          checkingForUpdates={updater.checking}
          updateMessage={updater.message}
          onLogin={() => void agent.login()}
          loggingIn={agent.loggingIn}
          loginError={agent.loginError}
          loggedIn={agent.loggedIn}
        />
      )}

      {updater.update && (
        <UpdatePrompt
          update={updater.update}
          installing={updater.installing}
          error={updater.message?.startsWith("Could not install") ? updater.message : null}
          onInstall={() => void updater.installUpdate()}
          onDismiss={updater.dismissUpdate}
        />
      )}
    </div>
  );
}

export default App;
