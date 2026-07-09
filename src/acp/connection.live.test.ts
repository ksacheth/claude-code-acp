import { describe, it, expect } from "vitest";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { methods } from "@agentclientprotocol/sdk";

import { connectAgent } from "./connection";
import type { LineChannel } from "./transport";

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
          if (n.update.sessionUpdate === "agent_message_chunk" && n.update.content.type === "text") {
            textBySession[n.sessionId] = (textBySession[n.sessionId] ?? "") + n.update.content.text;
          }
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
});
