import { useEffect, useState } from "react";
import type { SessionInfo } from "@agentclientprotocol/sdk";

import "./App.css";
import { AuthBanner } from "./components/AuthBanner";
import { DeleteSessionModal } from "./components/DeleteSessionModal";
import { DisconnectBanner } from "./components/DisconnectBanner";
import { ElicitationModal } from "./components/ElicitationModal";
import { Header } from "./components/Header";
import { HistoryBrowser } from "./components/HistoryBrowser";
import { PermissionModal } from "./components/PermissionModal";
import { SettingsModal } from "./components/SettingsModal";
import { Sidebar } from "./components/Sidebar";
import { UpdatePrompt } from "./components/UpdatePrompt";
import { Workspace } from "./components/Workspace";
import { useTheme } from "./session/theme";
import { messageText } from "./session/transcript";
import { useAgent, type SessionState } from "./useAgent";
import { useUpdater } from "./useUpdater";

const SIDEBAR_STORAGE_KEY = "claude-tauri.sidebar-open";

function initialSidebarOpen(): boolean {
  try {
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored !== null) return stored === "true";
  } catch {
    // Storage can be unavailable in hardened webviews; keep the UI usable.
  }
  return window.innerWidth > 680;
}

function App() {
  const agent = useAgent();
  const { status, agentInfo, error, active } = agent;
  const connected = status === "connected";
  useTheme(agent.settings.theme);
  const updater = useUpdater();

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyList, setHistoryList] = useState<SessionInfo[] | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<SessionState>();
  const [deletingSession, setDeletingSession] = useState(false);
  const [deleteSessionError, setDeleteSessionError] = useState<string>();
  const [sidebarOpen, setSidebarOpen] = useState(initialSidebarOpen);
  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarOpen));
    } catch {
      // Keep the in-memory toggle working even if persistence is unavailable.
    }
  }, [sidebarOpen]);
  const openHistory = () => {
    setHistoryList(null);
    setHistoryOpen(true);
    void agent.listSessions().then(setHistoryList);
  };
  const needsLogin =
    active?.transcript.messages.some(
      (message) =>
        message.role === "assistant" &&
        /not logged in|please run \/login/i.test(messageText(message)),
    ) ?? false;
  const confirmDeleteSession = async () => {
    if (!sessionToDelete || deletingSession) return;
    setDeletingSession(true);
    setDeleteSessionError(undefined);
    try {
      await agent.deleteSession({ sessionId: sessionToDelete.id });
      setHistoryList(
        (sessions) =>
          sessions?.filter((session) => session.sessionId !== sessionToDelete.id) ?? null,
      );
      setSessionToDelete(undefined);
    } catch (error) {
      setDeleteSessionError(error instanceof Error ? error.message : String(error));
    } finally {
      setDeletingSession(false);
    }
  };

  return (
    <div className={`app-shell${sidebarOpen ? " sidebar-open" : ""}`}>
      {sidebarOpen && (
        <Sidebar
          sessions={agent.sessions}
          activeId={agent.activeId}
          onSelect={agent.switchSession}
          onNew={() => void agent.newSession()}
          onHistory={openHistory}
          onSettings={() => setSettingsOpen(true)}
          onCollapse={() => setSidebarOpen(false)}
          onDelete={(session) => {
            setDeleteSessionError(undefined);
            setSessionToDelete(session);
          }}
          disabled={!connected}
        />
      )}

      <main className="app">
        <Header
          status={status}
          agentInfo={agentInfo}
          rateLimits={active?.usage?.rateLimits}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((open) => !open)}
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
          usage={active?.usage}
          onSetConfig={(configId, value) => void agent.setConfig(configId, value)}
        />
      </main>

      {agent.permission && (
        <PermissionModal request={agent.permission} onResolve={agent.resolvePermission} />
      )}
      {agent.elicitation && (
        <ElicitationModal request={agent.elicitation} onResolve={agent.resolveElicitation} />
      )}
      {sessionToDelete && (
        <DeleteSessionModal
          session={sessionToDelete}
          deleting={deletingSession}
          error={deleteSessionError}
          onConfirm={() => void confirmDeleteSession()}
          onCancel={() => setSessionToDelete(undefined)}
        />
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
              setHistoryList(
                (sessions) =>
                  sessions?.filter((session) => session.sessionId !== info.sessionId) ?? null,
              );
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
