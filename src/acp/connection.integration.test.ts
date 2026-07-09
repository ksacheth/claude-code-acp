import { describe, it, expect } from "vitest";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { connectAgent } from "./connection";
import type { LineChannel } from "./transport";

/// A `LineChannel` backed by a real child process — the same contract the Tauri
/// bridge implements, but driven through Node so the handshake can be exercised
/// end-to-end in vitest.
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

describe.skipIf(!existsSync(ENGINE))("connectAgent against the real engine", () => {
  it("completes the initialize handshake and reports agent info", async () => {
    const child = spawn("node", [ENGINE], {
      stdio: ["pipe", "pipe", "pipe"],
    }) as ChildProcessWithoutNullStreams;

    try {
      const conn = await connectAgent(childChannel(child));
      expect(conn.agentInfo?.name).toBeTruthy();
      expect(conn.agentInfo?.version).toBeTruthy();
      // The engine advertises loadSession per its initialize response.
      expect(conn.capabilities?.loadSession).toBe(true);
    } finally {
      child.stdin.end();
      child.kill();
    }
  }, 20000);
});
