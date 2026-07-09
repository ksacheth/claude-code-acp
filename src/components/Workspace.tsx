import type { SessionState } from "../session/sessions";
import { Composer } from "./Composer";
import { PlanChecklist } from "./PlanChecklist";
import { TranscriptView } from "./Transcript";

interface WorkspaceProps {
  active?: SessionState;
  connected: boolean;
  canPrompt: boolean;
  onNewSession: () => void;
  onSend: (text: string) => void;
  onCancel: () => void;
}

/// The main pane: the active session's transcript, plan, and composer — or a
/// prompt to open one when there is no active session.
export function Workspace({
  active,
  connected,
  canPrompt,
  onNewSession,
  onSend,
  onCancel,
}: WorkspaceProps) {
  if (!active) {
    return (
      <section className="transcript">
        {connected && (
          <div className="empty">
            <p>Open a project directory to start a session.</p>
            <button onClick={onNewSession}>New session…</button>
          </div>
        )}
      </section>
    );
  }

  return (
    <>
      <TranscriptView messages={active.transcript.messages} />
      {active.plan && <PlanChecklist entries={active.plan} />}
      <Composer
        cwd={active.cwd}
        disabled={!connected}
        canSend={canPrompt}
        busy={active.transcript.turnActive}
        commands={active.commands}
        onSend={onSend}
        onCancel={onCancel}
      />
    </>
  );
}
