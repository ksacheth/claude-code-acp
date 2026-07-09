import { describe, it, expect } from "vitest";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";

import { methods, type NewSessionResponse, type SessionUpdate } from "@agentclientprotocol/sdk";

import { connectAgent } from "./connection";
import type { LineChannel } from "./transport";

/// A model value to switch TO for the round-trip test: the first model option
/// that isn't already selected, or null if the deployment offers only one.
function alternateModelValue(configOptions: NewSessionResponse["configOptions"]): string | null {
  const model = configOptions?.find((o) => o.id === "model");
  if (model?.type !== "select") throw new Error("model config option missing or not a select");
  const values = model.options.flatMap((o) => ("options" in o ? o.options : [o]));
  return values.find((v) => v.value !== model.currentValue)?.value ?? null;
}

/// Text of a message chunk (agent or user), or null for other updates.
function messageChunkText(update: SessionUpdate): string | null {
  if (update.sessionUpdate !== "agent_message_chunk" && update.sessionUpdate !== "user_message_chunk") {
    return null;
  }
  return update.content.type === "text" ? update.content.text : null;
}

/// A real end-to-end prompt against the engine, exercising the model with the
/// user's Claude Code auth. Costs tokens and needs network, so it is gated
/// behind RUN_LIVE_PROMPT=1 and never runs in the default suite.
function childChannel(child: ChildProcessWithoutNullStreams): LineChannel {
  const rl = createInterface({ input: child.stdout });
  return {
    sendLine(line) {
      child.stdin.write(line + "\n");
    },
    subscribe(onLine, onClose) {
      rl.on("line", onLine);
      child.on("exit", onClose);
      return () => {
        rl.off("line", onLine);
        child.off("exit", onClose);
      };
    },
  };
}

/// A minimal stdio MCP server exposing one `echo` tool, used to prove a
/// user-configured MCP server's tool call executes and renders. Speaks
/// newline-delimited JSON-RPC (the MCP stdio transport).
const ECHO_MCP_SERVER = `
const send = (m) => process.stdout.write(JSON.stringify(m) + "\\n");
const RESULTS = {
  initialize: (p) => ({ protocolVersion: p?.protocolVersion ?? "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "echo-mcp", version: "0.0.1" } }),
  "tools/list": () => ({ tools: [{ name: "echo", description: "Echo back the provided text", inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] } }] }),
  "tools/call": (p) => ({ content: [{ type: "text", text: "echo: " + (p?.arguments?.text ?? "") }] }),
};
function handle(msg) {
  const build = RESULTS[msg.method];
  if (build) send({ jsonrpc: "2.0", id: msg.id, result: build(msg.params) });
  else if (msg.id !== undefined) send({ jsonrpc: "2.0", id: msg.id, result: {} });
}
let buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => {
  buf += d;
  let i;
  while ((i = buf.indexOf("\\n")) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (line) { try { handle(JSON.parse(line)); } catch {} }
  }
});
`;

/// Write the echo MCP server to a temp file and return its path.
function writeEchoServer(): string {
  const path = join(mkdtempSync(join(tmpdir(), "echo-mcp-")), "server.mjs");
  writeFileSync(path, ECHO_MCP_SERVER);
  return path;
}

const ENGINE = resolve(process.cwd(), "../dist/index.js");
const enabled = !!process.env.RUN_LIVE_PROMPT && existsSync(ENGINE);

describe.skipIf(!enabled)("live prompt against the real model", () => {
  it("streams an assistant reply for a prompt", async () => {
    const child = spawn("node", [ENGINE], {
      stdio: ["pipe", "pipe", "pipe"],
    }) as ChildProcessWithoutNullStreams;

    let streamedText = "";
    try {
      const conn = await connectAgent(childChannel(child), {
        onSessionUpdate: (n) => {
          if (n.update.sessionUpdate === "agent_message_chunk" && n.update.content.type === "text") {
            streamedText += n.update.content.text;
          }
        },
      });

      const session = await conn.ctx.request(methods.agent.session.new, {
        cwd: process.cwd(),
        mcpServers: [],
      });

      const result = await conn.ctx.request(methods.agent.session.prompt, {
        sessionId: session.sessionId,
        prompt: [{ type: "text", text: "Reply with exactly the word: pong" }],
      });

      expect(result.stopReason).toBe("end_turn");
      expect(streamedText.toLowerCase()).toContain("pong");
    } finally {
      child.stdin.end();
      child.kill();
    }
  }, 60000);

  it("streams visible thinking text on a reasoning prompt", async () => {
    const child = spawn("node", [ENGINE], {
      stdio: ["pipe", "pipe", "pipe"],
    }) as ChildProcessWithoutNullStreams;

    let thought = "";
    try {
      const conn = await connectAgent(childChannel(child), {
        onSessionUpdate: (n) => {
          if (n.update.sessionUpdate === "agent_thought_chunk" && n.update.content.type === "text") {
            thought += n.update.content.text;
          }
        },
      });
      const session = await conn.ctx.request(methods.agent.session.new, {
        cwd: process.cwd(),
        mcpServers: [],
      });
      await conn.ctx.request(methods.agent.session.prompt, {
        sessionId: session.sessionId,
        prompt: [
          {
            type: "text",
            text: "Reason step by step: a farmer has 17 sheep, all but 9 die, he buys 4 more, then sells a third of the flock. Show your reasoning, then give the final count.",
          },
        ],
      });
      // The engine defaults to adaptive + summarized thinking, so a genuine
      // reasoning prompt should stream non-empty thought text.
      expect(thought.trim().length).toBeGreaterThan(0);
    } finally {
      child.stdin.end();
      child.kill();
    }
  }, 60000);

  it("cancels an in-flight turn (stopReason cancelled)", async () => {
    const child = spawn("node", [ENGINE], {
      stdio: ["pipe", "pipe", "pipe"],
    }) as ChildProcessWithoutNullStreams;

    try {
      let session = "";
      const conn = await connectAgent(childChannel(child), {
        onSessionUpdate: (n) => {
          // Cancel as soon as the reply starts streaming.
          if (n.update.sessionUpdate === "agent_message_chunk" && session) {
            void conn.ctx.notify(methods.agent.session.cancel, { sessionId: session });
          }
        },
      });
      const created = await conn.ctx.request(methods.agent.session.new, {
        cwd: process.cwd(),
        mcpServers: [],
      });
      session = created.sessionId;

      const result = await conn.ctx.request(methods.agent.session.prompt, {
        sessionId: session,
        prompt: [{ type: "text", text: "Count slowly from 1 to 300, one number per line." }],
      });
      expect(result.stopReason).toBe("cancelled");
    } finally {
      child.stdin.end();
      child.kill();
    }
  }, 60000);

  it("streams a tool call when the agent uses a tool (permission granted)", async () => {
    const child = spawn("node", [ENGINE], {
      stdio: ["pipe", "pipe", "pipe"],
    }) as ChildProcessWithoutNullStreams;

    const toolTitles: string[] = [];
    try {
      const conn = await connectAgent(childChannel(child), {
        onSessionUpdate: (n) => {
          if (n.update.sessionUpdate === "tool_call") toolTitles.push(n.update.title);
        },
        onPermissionRequest: async (req) => {
          const allow = req.options.find((o) => o.kind.startsWith("allow")) ?? req.options[0];
          return { outcome: { outcome: "selected", optionId: allow.optionId } };
        },
      });
      const session = await conn.ctx.request(methods.agent.session.new, {
        cwd: process.cwd(),
        mcpServers: [],
      });
      await conn.ctx.request(methods.agent.session.prompt, {
        sessionId: session.sessionId,
        prompt: [
          {
            type: "text",
            text: "Read the file package.json in the current directory and tell me its \"name\" field. Use your file-reading tool.",
          },
        ],
      });
      expect(toolTitles.length).toBeGreaterThan(0);
    } finally {
      child.stdin.end();
      child.kill();
    }
  }, 60000);

  it("runs two concurrent sessions with updates isolated by sessionId", async () => {
    const child = spawn("node", [ENGINE], {
      stdio: ["pipe", "pipe", "pipe"],
    }) as ChildProcessWithoutNullStreams;

    const textBySession: Record<string, string> = {};
    try {
      const conn = await connectAgent(childChannel(child), {
        onSessionUpdate: (n) => {
          const text = messageChunkText(n.update);
          if (text) textBySession[n.sessionId] = (textBySession[n.sessionId] ?? "") + text;
        },
      });

      const a = await conn.ctx.request(methods.agent.session.new, { cwd: process.cwd(), mcpServers: [] });
      const b = await conn.ctx.request(methods.agent.session.new, { cwd: process.cwd(), mcpServers: [] });
      expect(a.sessionId).not.toBe(b.sessionId);

      // Fire both turns concurrently on the single connection.
      await Promise.all([
        conn.ctx.request(methods.agent.session.prompt, {
          sessionId: a.sessionId,
          prompt: [{ type: "text", text: "Reply with exactly the word: apple" }],
        }),
        conn.ctx.request(methods.agent.session.prompt, {
          sessionId: b.sessionId,
          prompt: [{ type: "text", text: "Reply with exactly the word: banana" }],
        }),
      ]);

      expect(textBySession[a.sessionId]?.toLowerCase()).toContain("apple");
      expect(textBySession[b.sessionId]?.toLowerCase()).toContain("banana");
      // Isolation: neither session's reply leaked into the other.
      expect(textBySession[a.sessionId]?.toLowerCase()).not.toContain("banana");
      expect(textBySession[b.sessionId]?.toLowerCase()).not.toContain("apple");
    } finally {
      child.stdin.end();
      child.kill();
    }
  }, 90000);

  it("round-trips a model change through set_config_option", async () => {
    const child = spawn("node", [ENGINE], {
      stdio: ["pipe", "pipe", "pipe"],
    }) as ChildProcessWithoutNullStreams;

    try {
      const conn = await connectAgent(childChannel(child));
      const session = await conn.ctx.request(methods.agent.session.new, {
        cwd: process.cwd(),
        mcpServers: [],
      });

      // The engine unifies mode/model/effort into configOptions on session/new.
      // Pick a value to switch to; skip if the deployment offers a single model.
      const target = alternateModelValue(session.configOptions);
      if (!target) return;

      const response = await conn.ctx.request(methods.agent.session.setConfigOption, {
        sessionId: session.sessionId,
        configId: "model",
        value: target,
      });
      const updated = response.configOptions.find((o) => o.id === "model");
      expect(updated?.type === "select" && updated.currentValue).toBe(target);
    } finally {
      child.stdin.end();
      child.kill();
    }
  }, 60000);

  it("announces the agent's slash commands after session/new", async () => {
    const child = spawn("node", [ENGINE], {
      stdio: ["pipe", "pipe", "pipe"],
    }) as ChildProcessWithoutNullStreams;

    try {
      let names: string[] = [];
      const gotCommands = new Promise<void>((resolveGot) => {
        void connectAgent(childChannel(child), {
          onSessionUpdate: (n) => {
            if (n.update.sessionUpdate === "available_commands_update") {
              names = n.update.availableCommands.map((c) => c.name);
              resolveGot();
            }
          },
        }).then((conn) =>
          conn.ctx.request(methods.agent.session.new, { cwd: process.cwd(), mcpServers: [] }),
        );
      });

      await gotCommands;
      // The engine ships built-in commands (e.g. compact); the palette renders
      // whatever this list contains.
      expect(names.length).toBeGreaterThan(0);
    } finally {
      child.stdin.end();
      child.kill();
    }
  }, 60000);

  it("executes a tool from a user-configured stdio MCP server", async () => {
    const serverPath = writeEchoServer();
    const child = spawn("node", [ENGINE], {
      stdio: ["pipe", "pipe", "pipe"],
    }) as ChildProcessWithoutNullStreams;

    const toolCalls: string[] = [];
    let reply = "";
    try {
      const conn = await connectAgent(childChannel(child), {
        onSessionUpdate: (n) => {
          if (n.update.sessionUpdate === "tool_call") {
            toolCalls.push(`${n.update.title} ${JSON.stringify(n.update.rawInput ?? "")}`);
          }
          reply += messageChunkText(n.update) ?? "";
        },
        onPermissionRequest: async (req) => {
          const allow = req.options.find((o) => o.kind.startsWith("allow")) ?? req.options[0];
          return { outcome: { outcome: "selected", optionId: allow.optionId } };
        },
      });

      // Configure the echo MCP server exactly as the app does (stdio: no type).
      const session = await conn.ctx.request(methods.agent.session.new, {
        cwd: process.cwd(),
        mcpServers: [{ name: "echo", command: "node", args: [serverPath], env: [] }],
      });

      await conn.ctx.request(methods.agent.session.prompt, {
        sessionId: session.sessionId,
        prompt: [
          {
            type: "text",
            text: "Call the `echo` tool (from the echo MCP server) with text \"banana\", then tell me exactly what it returned.",
          },
        ],
      });

      // The MCP tool call must have streamed like any built-in tool call.
      expect(toolCalls.some((t) => /echo/i.test(t))).toBe(true);
      expect(reply.toLowerCase()).toContain("banana");
    } finally {
      child.stdin.end();
      child.kill();
    }
  }, 90000);

  it("resumes a persisted session and replays its history in a fresh process", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "resume-"));
    const codeword = "xyzzy";

    // Process 1: create a session and exchange a message, then quit.
    const first = spawn("node", [ENGINE], { stdio: ["pipe", "pipe", "pipe"] }) as ChildProcessWithoutNullStreams;
    let sessionId = "";
    try {
      const conn = await connectAgent(childChannel(first));
      const created = await conn.ctx.request(methods.agent.session.new, { cwd, mcpServers: [] });
      sessionId = created.sessionId;
      await conn.ctx.request(methods.agent.session.prompt, {
        sessionId,
        prompt: [{ type: "text", text: `Remember this codeword and reply with it: ${codeword}` }],
      });
    } finally {
      first.stdin.end();
      first.kill();
    }

    // Process 2: a fresh engine loads that session; its history must replay.
    const second = spawn("node", [ENGINE], { stdio: ["pipe", "pipe", "pipe"] }) as ChildProcessWithoutNullStreams;
    let replayed = "";
    try {
      const conn = await connectAgent(childChannel(second), {
        onSessionUpdate: (n) => {
          replayed += messageChunkText(n.update) ?? "";
        },
      });
      await conn.ctx.request(methods.agent.session.load, { sessionId, cwd, mcpServers: [] });
      expect(replayed.toLowerCase()).toContain(codeword);
    } finally {
      second.stdin.end();
      second.kill();
    }
  }, 90000);
});
