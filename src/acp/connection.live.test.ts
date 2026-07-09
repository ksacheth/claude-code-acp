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
});
