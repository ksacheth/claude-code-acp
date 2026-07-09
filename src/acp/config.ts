/// Resolves how to launch the ACP engine.
///
/// M0 uses a fixed absolute path (overridable via the `VITE_ENGINE_PATH` build
/// env var). T6 replaces this with Rust-side resolution relative to the app
/// plus a user-facing setting; until then this is intentionally machine-local.
const DEFAULT_ENGINE_PATH = "/Users/sacheth/claude-agent-acp/dist/index.js";

export interface EngineLaunch {
  command: string;
  args: string[];
}

export function engineLaunch(): EngineLaunch {
  const enginePath =
    (import.meta.env.VITE_ENGINE_PATH as string | undefined) ?? DEFAULT_ENGINE_PATH;
  return { command: "node", args: [enginePath] };
}
