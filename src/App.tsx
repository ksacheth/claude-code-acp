import { useState, type FormEvent } from "react";

import "./App.css";
import { Markdown } from "./components/Markdown";
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
  const [draft, setDraft] = useState("");

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const text = draft;
    setDraft("");
    void agent.sendPrompt(text);
  };

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

      <section className="transcript">
        {!cwd && status === "connected" && (
          <div className="empty">
            <p>Choose a project directory to start a session.</p>
            <button onClick={() => void agent.pickDirectory()}>Choose directory…</button>
          </div>
        )}
        {transcript.messages.map((m) => (
          <div key={m.id} className={`message message-${m.role}`}>
            <div className="role">{m.role}</div>
            <div className="text">
              {m.role === "assistant" ? <Markdown text={m.text} /> : m.text}
              {m.streaming && <span className="caret" />}
            </div>
          </div>
        ))}
      </section>

      {cwd && (
        <form className="composer" onSubmit={onSubmit}>
          <div className="cwd" title={cwd}>
            {cwd}
          </div>
          <div className="composer-row">
            <input
              value={draft}
              onChange={(e) => setDraft(e.currentTarget.value)}
              placeholder="Send a message…"
              disabled={status !== "connected"}
            />
            <button type="submit" disabled={!agent.canPrompt || draft.trim().length === 0}>
              {transcript.turnActive ? "…" : "Send"}
            </button>
          </div>
        </form>
      )}
    </main>
  );
}

export default App;
