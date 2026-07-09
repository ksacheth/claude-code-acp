import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type { LineChannel } from "./transport";
import type { EnvVar } from "../session/settings";

/// How to spawn the engine, sourced from settings. All fields are optional —
/// omit to fall back to auto-resolution / `node` / no extra env.
export interface SpawnConfig {
  /// Absolute path to the engine's `dist/index.js` (overrides auto-resolution).
  enginePath?: string;
  /// The node binary to launch (default `node`).
  nodePath?: string;
  /// Extra env for the engine spawn (e.g. a full PATH for a Finder launch).
  env: EnvVar[];
}

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

/// Resolve the engine path. Precedence: the settings override, then the
/// `VITE_ENGINE_PATH` build override, then Rust's `CLAUDE_TAURI_ENGINE` / dev
/// default.
async function resolveEnginePath(override?: string): Promise<string> {
  const build = import.meta.env.VITE_ENGINE_PATH as string | undefined;
  const path = override ?? build ?? (await invoke<string | null>("default_engine_path"));
  if (!path) {
    throw new Error(
      "Engine not found. Set the engine path in Settings, set CLAUDE_TAURI_ENGINE " +
        "to the built dist/index.js, or build the engine in the parent repo.",
    );
  }
  return path;
}

/// Spawn the engine subprocess with the given config. Resolves once the OS has
/// launched it (before the handshake).
export async function startAgent(config: SpawnConfig = { env: [] }): Promise<void> {
  const enginePath = await resolveEnginePath(config.enginePath);
  const env = config.env.map((e) => [e.name, e.value] as [string, string]);
  return invoke("agent_start", {
    command: config.nodePath || "node",
    args: [enginePath],
    cwd: null,
    env,
  });
}

/// Stop the engine subprocess.
export function stopAgent(): Promise<void> {
  return invoke("agent_stop");
}
