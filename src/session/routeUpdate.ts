import type { SessionModeId, SessionUpdate } from "@agentclientprotocol/sdk";

import type { Usage } from "./usage";

/// Sinks for the session-scoped updates the app tracks outside the transcript.
export interface UpdateHandlers {
  onUsage: (usage: Usage) => void;
  onModeChange: (modeId: SessionModeId) => void;
  /// Everything else (message/thought chunks, tool calls) goes to the transcript.
  onTranscript: (update: SessionUpdate) => void;
}

/// Route one streaming session update to the right sink. Keeps the hook's
/// callback trivial and this logic unit-testable.
export function routeSessionUpdate(update: SessionUpdate, handlers: UpdateHandlers): void {
  switch (update.sessionUpdate) {
    case "usage_update":
      handlers.onUsage({ used: update.used, size: update.size, cost: update.cost });
      return;
    case "current_mode_update":
      handlers.onModeChange(update.currentModeId);
      return;
    default:
      handlers.onTranscript(update);
  }
}
