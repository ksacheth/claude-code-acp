import { describe, it, expect, vi } from "vitest";
import type { SessionUpdate } from "@agentclientprotocol/sdk";

import { routeSessionUpdate, type UpdateHandlers } from "./routeUpdate";

function handlers(): UpdateHandlers & {
  usage: ReturnType<typeof vi.fn>;
  mode: ReturnType<typeof vi.fn>;
  transcript: ReturnType<typeof vi.fn>;
} {
  const usage = vi.fn();
  const mode = vi.fn();
  const transcript = vi.fn();
  return { onUsage: usage, onModeChange: mode, onTranscript: transcript, usage, mode, transcript };
}

describe("routeSessionUpdate", () => {
  it("routes usage_update to onUsage", () => {
    const h = handlers();
    routeSessionUpdate(
      { sessionUpdate: "usage_update", used: 10, size: 200, cost: null } as SessionUpdate,
      h,
    );
    expect(h.usage).toHaveBeenCalledWith({ used: 10, size: 200, cost: null });
    expect(h.transcript).not.toHaveBeenCalled();
  });

  it("routes current_mode_update to onModeChange", () => {
    const h = handlers();
    routeSessionUpdate(
      { sessionUpdate: "current_mode_update", currentModeId: "plan" } as SessionUpdate,
      h,
    );
    expect(h.mode).toHaveBeenCalledWith("plan");
    expect(h.transcript).not.toHaveBeenCalled();
  });

  it("routes message chunks and tool calls to onTranscript", () => {
    const h = handlers();
    const chunk = {
      sessionUpdate: "agent_message_chunk",
      content: { type: "text", text: "hi" },
    } as SessionUpdate;
    routeSessionUpdate(chunk, h);
    expect(h.transcript).toHaveBeenCalledWith(chunk);
    expect(h.usage).not.toHaveBeenCalled();
    expect(h.mode).not.toHaveBeenCalled();
  });
});
