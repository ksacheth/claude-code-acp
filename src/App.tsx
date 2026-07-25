import { useEffect, useState } from "react";

import "./App.css";
import { AuthBanner } from "./components/AuthBanner";
import { DeleteSessionModal } from "./components/DeleteSessionModal";
import { DisconnectBanner } from "./components/DisconnectBanner";
import { ElicitationModal } from "./components/ElicitationModal";
import { Header } from "./components/Header";
import { PermissionModal } from "./components/PermissionModal";
import { SettingsModal } from "./components/SettingsModal";
import { Sidebar } from "./components/Sidebar";
import { UpdatePrompt } from "./components/UpdatePrompt";
import { Workspace } from "./components/Workspace";
import type { ChatEntry } from "./session/projects";
import { useSidebar } from "./session/useSidebar";
import { useTheme } from "./session/theme";
import { messageText } from "./session/transcript";
import { useAgent } from "./useAgent";
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
  const sidebar = useSidebar(agent.sessionList, agent.sessions, agent.activeId, agent.settings);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<ChatEntry>();
  const [deletingChat, setDeletingChat] = useState(false);
  const [deleteChatError, setDeleteChatError] = useState<string>();
  const [sidebarOpen, setSidebarOpen] = useState(initialSidebarOpen);
  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarOpen));
    } catch {
      // Keep the in-memory toggle working even if persistence is unavailable.
    }
  }, [sidebarOpen]);
  const needsLogin =
    active?.transcript.messages.some(
      (message) =>
        message.role === "assistant" &&
        /not logged in|please run \/login/i.test(messageText(message)),
    ) ?? false;
  const confirmDeleteChat = async () => {
    if (!chatToDelete || deletingChat) return;
    setDeletingChat(true);
    setDeleteChatError(undefined);
    try {
      await agent.deleteSession({ sessionId: chatToDelete.id });
      setChatToDelete(undefined);
    } catch (error) {
      setDeleteChatError(error instanceof Error ? error.message : String(error));
    } finally {
      setDeletingChat(false);
    }
  };

  return (
    <div className={`app-shell${sidebarOpen ? " sidebar-open" : ""}`}>
      {sidebarOpen && (
        <Sidebar
          tree={sidebar.tree}
          loading={agent.sessionList === null}
          activeId={agent.activeId}
          expanded={sidebar.expanded}
          nowMs={Date.now()}
          disabled={!connected}
          onToggleProject={sidebar.toggleProject}
          onRenameProject={sidebar.renameProject}
          // Selecting resumes, which activates an already-loaded chat and loads
          // the rest on demand: that is what keeps launch off the critical path.
          onSelectChat={(chat) =>
            void agent.resumeSession({
              sessionId: chat.id,
              cwd: chat.cwd,
              title: chat.title,
              ...(chat.updatedAt ? { updatedAt: chat.updatedAt } : {}),
            })
          }
          onRenameChat={(chat, title) =>
            void agent.renameSession({ sessionId: chat.id, cwd: chat.cwd }, title)
          }
          onDeleteChat={(chat) => {
            setDeleteChatError(undefined);
            setChatToDelete(chat);
          }}
          onNewChat={() => void agent.newSession(sidebar.chatsDir)}
          onNewProject={() => void agent.newSession()}
          onSettings={() => setSettingsOpen(true)}
          onCollapse={() => setSidebarOpen(false)}
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
          onNewSession={() => void agent.newSession(sidebar.chatsDir)}
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
      {chatToDelete && (
        <DeleteSessionModal
          session={chatToDelete}
          deleting={deletingChat}
          error={deleteChatError}
          onConfirm={() => void confirmDeleteChat()}
          onCancel={() => setChatToDelete(undefined)}
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
