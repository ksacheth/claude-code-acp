import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type { LineChannel } from "./transport";

/// A `LineChannel` backed by the Rust process bridge: `agent_send` for output,
/// the `agent-stdout` / `agent-exit` events for input.
///
/// The agent must be started (via `startAgent`) before the ACP client writes to
/// this channel. The engine emits nothing until it receives `initialize`, so
/// subscribing here and then sending `initialize` never races a missed line.
export const tauriChannel: LineChannel = {
  sendLine(line: string): Promise<void> {
    return invoke("agent_send", { line });
  },

  subscribe(onLine, onClose): () => void {
    const unlisteners: UnlistenFn[] = [];
    let stopped = false;

    const register = (promise: Promise<UnlistenFn>) => {
      promise.then((un) => {
        if (stopped) un();
        else unlisteners.push(un);
      });
    };

    register(listen<string>("agent-stdout", (event) => onLine(event.payload)));
    register(listen<number | null>("agent-exit", () => onClose()));

    return () => {
      stopped = true;
      for (const un of unlisteners) un();
    };
  },
};

/// Resolve the engine path: an explicit `VITE_ENGINE_PATH` build override wins,
/// otherwise Rust resolves `CLAUDE_TAURI_ENGINE` or the dev default.
async function resolveEnginePath(): Promise<string> {
  const override = import.meta.env.VITE_ENGINE_PATH as string | undefined;
  const path = override ?? (await invoke<string | null>("default_engine_path"));
  if (!path) {
    throw new Error(
      "Engine not found. Set CLAUDE_TAURI_ENGINE to the built dist/index.js, " +
        "or build the engine in the parent repo.",
    );
  }
  return path;
}

/// Spawn the engine subprocess. Resolves once the OS has launched it (before
/// the handshake).
export async function startAgent(cwd?: string): Promise<void> {
  const enginePath = await resolveEnginePath();
  return invoke("agent_start", {
    command: "node",
    args: [enginePath],
    cwd: cwd ?? null,
  });
}

/// Stop the engine subprocess.
export function stopAgent(): Promise<void> {
  return invoke("agent_stop");
}
