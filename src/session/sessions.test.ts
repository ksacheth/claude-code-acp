import { describe, it, expect } from "vitest";
import type { SessionUpdate } from "@agentclientprotocol/sdk";

import { messageText } from "./transcript";

import {
  activeSession,
  emptySessions,
  sessionsReducer,
  titleFromCwd,
  type SessionsState,
} from "./sessions";

const textChunk = (text: string): SessionUpdate => ({
  sessionUpdate: "agent_message_chunk",
  content: { type: "text", text },
});

/// A single select-style config option array for the config-routing tests.
const selectConfig = (id: string, currentValue: string, values: string[]) =>
  [
    {
      id,
      name: id,
      type: "select",
      currentValue,
      options: values.map((v) => ({ value: v, name: v })),
    },
  ] as never;

/// The `currentValue` of the first config option after `state` settles.
const firstConfigValue = (state: SessionsState): unknown => {
  const option = activeSession(state)?.configOptions?.[0];
  return option && "currentValue" in option ? option.currentValue : undefined;
};

function withTwoSessions(): SessionsState {
  let state = sessionsReducer(emptySessions, { kind: "create", id: "A", cwd: "/repo/alpha" });
  state = sessionsReducer(state, { kind: "create", id: "B", cwd: "/repo/beta" });
  return state;
}

describe("titleFromCwd", () => {
  it("uses the final path segment", () => {
    expect(titleFromCwd("/Users/me/projects/webapp")).toBe("webapp");
    expect(titleFromCwd("/repo/")).toBe("repo");
  });
});

describe("sessionsReducer", () => {
  it("creates a session and makes it active", () => {
    const state = sessionsReducer(emptySessions, { kind: "create", id: "A", cwd: "/repo/alpha" });
    expect(state.sessions).toHaveLength(1);
    expect(state.activeId).toBe("A");
    expect(activeSession(state)?.title).toBe("alpha");
  });

  it("keeps creation order and switches the active session on create", () => {
    const state = withTwoSessions();
    expect(state.sessions.map((s) => s.id)).toEqual(["A", "B"]);
    expect(state.activeId).toBe("B");
  });

  it("activates an existing session", () => {
    const state = sessionsReducer(withTwoSessions(), { kind: "activate", id: "A" });
    expect(state.activeId).toBe("A");
  });

  it("isolates updates by sessionId — B's chunk never touches A", () => {
    let state = withTwoSessions();
    state = sessionsReducer(state, { kind: "submit", sessionId: "B", userId: "u", assistantId: "a", text: "hi" });
    state = sessionsReducer(state, { kind: "update", sessionId: "B", update: textChunk("hello") });
    const a = state.sessions.find((s) => s.id === "A")!;
    const b = state.sessions.find((s) => s.id === "B")!;
    const lastB = b.transcript.messages[b.transcript.messages.length - 1];
    expect(lastB && messageText(lastB)).toBe("hello");
    expect(a.transcript.messages).toHaveLength(0);
  });

  it("tracks turnActive independently per session", () => {
    let state = withTwoSessions();
    state = sessionsReducer(state, { kind: "submit", sessionId: "A", userId: "u", assistantId: "a", text: "x" });
    const a = state.sessions.find((s) => s.id === "A")!;
    const b = state.sessions.find((s) => s.id === "B")!;
    expect(a.transcript.turnActive).toBe(true);
    expect(b.transcript.turnActive).toBe(false);
  });

  it("routes usage and plan updates to the right session's fields", () => {
    let state = withTwoSessions();
    state = sessionsReducer(state, {
      kind: "update",
      sessionId: "A",
      update: { sessionUpdate: "usage_update", used: 10, size: 200, cost: null } as SessionUpdate,
    });
    state = sessionsReducer(state, {
      kind: "update",
      sessionId: "A",
      update: { sessionUpdate: "plan", entries: [{ content: "x", priority: "high", status: "pending" }] } as SessionUpdate,
    });
    const a = state.sessions.find((s) => s.id === "A")!;
    expect(a.usage).toEqual({ used: 10, size: 200, cost: null });
    expect(a.plan).toHaveLength(1);
    expect(state.sessions.find((s) => s.id === "B")!.usage).toBeUndefined();
  });

  it("removes a session and picks a remaining one as active", () => {
    const state = sessionsReducer(withTwoSessions(), { kind: "remove", id: "B" });
    expect(state.sessions.map((s) => s.id)).toEqual(["A"]);
    expect(state.activeId).toBe("A");
  });

  it("leaves activeId undefined when the last session is removed", () => {
    let state = sessionsReducer(emptySessions, { kind: "create", id: "A", cwd: "/repo/alpha" });
    state = sessionsReducer(state, { kind: "remove", id: "A" });
    expect(state.sessions).toHaveLength(0);
    expect(state.activeId).toBeUndefined();
  });

  it("updates a session's title from session_info_update", () => {
    let state = sessionsReducer(emptySessions, { kind: "create", id: "A", cwd: "/repo/alpha" });
    state = sessionsReducer(state, {
      kind: "update",
      sessionId: "A",
      update: { sessionUpdate: "session_info_update", title: "Fix the parser" } as SessionUpdate,
    });
    expect(activeSession(state)?.title).toBe("Fix the parser");
  });

  it("replaces config options on setConfig (authoritative)", () => {
    let state = sessionsReducer(emptySessions, { kind: "create", id: "A", cwd: "/repo/alpha" });
    const configOptions = [
      { id: "model", name: "Model", type: "select", currentValue: "opus", options: [{ value: "opus", name: "Opus" }] },
    ] as never;
    state = sessionsReducer(state, { kind: "setConfig", sessionId: "A", configOptions });
    expect(activeSession(state)?.configOptions).toBe(configOptions);
  });

  it("optimistically patches one config value on patchConfig", () => {
    const configOptions = selectConfig("model", "opus", ["opus", "sonnet"]);
    let state = sessionsReducer(emptySessions, { kind: "create", id: "A", cwd: "/repo/alpha", configOptions });
    state = sessionsReducer(state, { kind: "patchConfig", sessionId: "A", configId: "model", value: "sonnet" });
    expect(firstConfigValue(state)).toBe("sonnet");
  });

  it("keeps the mode config value in sync from current_mode_update", () => {
    const configOptions = selectConfig("mode", "default", ["default", "plan"]);
    let state = sessionsReducer(emptySessions, { kind: "create", id: "A", cwd: "/repo/alpha", configOptions });
    state = sessionsReducer(state, {
      kind: "update",
      sessionId: "A",
      update: { sessionUpdate: "current_mode_update", currentModeId: "plan" } as SessionUpdate,
    });
    expect(firstConfigValue(state)).toBe("plan");
  });

  it("routes available_commands_update to the session's commands", () => {
    let state = sessionsReducer(emptySessions, { kind: "create", id: "A", cwd: "/repo/alpha" });
    state = sessionsReducer(state, {
      kind: "update",
      sessionId: "A",
      update: {
        sessionUpdate: "available_commands_update",
        availableCommands: [{ name: "compact", description: "Compact the context" }],
      } as SessionUpdate,
    });
    expect(activeSession(state)?.commands?.[0].name).toBe("compact");
  });

  it("create is idempotent — re-creating an open session preserves its transcript", () => {
    let state = sessionsReducer(emptySessions, { kind: "create", id: "A", cwd: "/repo/alpha" });
    state = sessionsReducer(state, { kind: "submit", sessionId: "A", userId: "u", assistantId: "a", text: "hi" });
    // Re-create (as a resume of an already-open session) must not blank it.
    state = sessionsReducer(state, { kind: "create", id: "A", cwd: "/repo/alpha" });
    expect(state.sessions).toHaveLength(1);
    expect(activeSession(state)?.transcript.messages).toHaveLength(2);
  });
});
