import { describe, it, expect } from "vitest";
import type { SessionUpdate } from "@agentclientprotocol/sdk";

import { emptyTranscript, transcriptReducer, type TranscriptState } from "./transcript";

const textChunk = (text: string): SessionUpdate => ({
  sessionUpdate: "agent_message_chunk",
  content: { type: "text", text },
});

const thoughtChunk = (text: string): SessionUpdate => ({
  sessionUpdate: "agent_thought_chunk",
  content: { type: "text", text },
});

const submit = (state: TranscriptState, text: string) =>
  transcriptReducer(state, { kind: "submit", userId: "u1", assistantId: "a1", text });

describe("transcriptReducer", () => {
  it("opens a user message and an empty streaming assistant message on submit", () => {
    const state = submit(emptyTranscript, "say hi");
    expect(state.turnActive).toBe(true);
    expect(state.messages).toEqual([
      { id: "u1", role: "user", text: "say hi", thought: "", toolCalls: [], streaming: false },
      { id: "a1", role: "assistant", text: "", thought: "", toolCalls: [], streaming: true },
    ]);
  });

  it("appends successive agent_message_chunks to the open assistant message", () => {
    let state = submit(emptyTranscript, "hi");
    state = transcriptReducer(state, { kind: "update", update: textChunk("Hel") });
    state = transcriptReducer(state, { kind: "update", update: textChunk("lo") });
    const assistant = state.messages[1];
    expect(assistant.text).toBe("Hello");
    expect(assistant.streaming).toBe(true);
  });

  it("accumulates thought chunks into the assistant's thought, separate from text", () => {
    let state = submit(emptyTranscript, "hi");
    state = transcriptReducer(state, { kind: "update", update: thoughtChunk("Let me ") });
    state = transcriptReducer(state, { kind: "update", update: thoughtChunk("think.") });
    state = transcriptReducer(state, { kind: "update", update: textChunk("Answer") });
    const assistant = state.messages[1];
    expect(assistant.thought).toBe("Let me think.");
    expect(assistant.text).toBe("Answer");
  });

  it("closes streaming and the turn on end", () => {
    let state = submit(emptyTranscript, "hi");
    state = transcriptReducer(state, { kind: "update", update: textChunk("done") });
    state = transcriptReducer(state, { kind: "end" });
    expect(state.turnActive).toBe(false);
    expect(state.messages[1].streaming).toBe(false);
    expect(state.messages[1].text).toBe("done");
  });

  it("keeps earlier turns intact across a second submit", () => {
    let state = submit(emptyTranscript, "first");
    state = transcriptReducer(state, { kind: "update", update: textChunk("one") });
    state = transcriptReducer(state, { kind: "end" });
    state = transcriptReducer(state, { kind: "submit", userId: "u2", assistantId: "a2", text: "second" });
    expect(state.messages.map((m) => m.text)).toEqual(["first", "one", "second", ""]);
  });

  it("defensively opens an assistant message if a chunk arrives with none open", () => {
    const state = transcriptReducer(emptyTranscript, { kind: "update", update: textChunk("orphan") });
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]).toMatchObject({ role: "assistant", text: "orphan", streaming: true });
  });

  const toolCall = (over: Partial<Record<string, unknown>> = {}): SessionUpdate =>
    ({
      sessionUpdate: "tool_call",
      toolCallId: "t1",
      title: "Edit file.ts",
      kind: "edit",
      status: "pending",
      rawInput: { path: "file.ts" },
      ...over,
    }) as SessionUpdate;

  const toolUpdate = (over: Partial<Record<string, unknown>> = {}): SessionUpdate =>
    ({ sessionUpdate: "tool_call_update", toolCallId: "t1", ...over }) as SessionUpdate;

  it("adds a tool call to the open assistant message", () => {
    let state = submit(emptyTranscript, "edit it");
    state = transcriptReducer(state, { kind: "update", update: toolCall() });
    const calls = state.messages[1].toolCalls;
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ id: "t1", title: "Edit file.ts", kind: "edit", status: "pending" });
  });

  it("merges tool_call_update fields by id without dropping unset ones", () => {
    let state = submit(emptyTranscript, "edit it");
    state = transcriptReducer(state, { kind: "update", update: toolCall() });
    state = transcriptReducer(state, {
      kind: "update",
      update: toolUpdate({ status: "completed", rawOutput: { ok: true } }),
    });
    const call = state.messages[1].toolCalls[0];
    expect(call.status).toBe("completed");
    expect(call.rawOutput).toEqual({ ok: true });
    // Unset fields survive the merge.
    expect(call.title).toBe("Edit file.ts");
    expect(call.kind).toBe("edit");
  });

  it("defaults kind and status when a tool_call omits them", () => {
    let state = submit(emptyTranscript, "run it");
    state = transcriptReducer(state, {
      kind: "update",
      update: toolCall({ kind: undefined, status: undefined }),
    });
    const call = state.messages[1].toolCalls[0];
    expect(call.kind).toBe("other");
    expect(call.status).toBe("pending");
  });

  it("tracks multiple tool calls independently", () => {
    let state = submit(emptyTranscript, "do two");
    state = transcriptReducer(state, { kind: "update", update: toolCall() });
    state = transcriptReducer(state, {
      kind: "update",
      update: toolCall({ toolCallId: "t2", title: "Read a.ts", kind: "read" }),
    });
    state = transcriptReducer(state, {
      kind: "update",
      update: toolUpdate({ toolCallId: "t2", status: "completed" }),
    });
    const calls = state.messages[1].toolCalls;
    expect(calls.map((c) => c.id)).toEqual(["t1", "t2"]);
    expect(calls[0].status).toBe("pending");
    expect(calls[1].status).toBe("completed");
  });
});
