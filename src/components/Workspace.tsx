import type { SessionState } from "../session/sessions";
import { Composer } from "./Composer";
import { PlanChecklist } from "./PlanChecklist";
import { TranscriptView } from "./Transcript";
import type { PromptImage } from "../session/attachments";

interface WorkspaceProps {
  active?: SessionState;
  connected: boolean;
  canPrompt: boolean;
  onNewSession: () => void;
  onSend: (text: string, images: PromptImage[]) => void;
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
            <div className="empty-mark">C</div>
            <h1>Start a new workspace</h1>
            <p>Choose a project folder to chat with Claude in its context.</p>
            <button onClick={onNewSession}>Choose project folder</button>
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
