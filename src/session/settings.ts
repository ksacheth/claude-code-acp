import type { McpServer } from "@agentclientprotocol/sdk";

/// A name=value pair (engine env, or an MCP server's env).
export interface EnvVar {
  name: string;
  value: string;
}

/// A stdio MCP server the user configured (the npx-based common case). Stored in
/// an edit-friendly shape and converted to the ACP wire type by `toMcpServers`.
export interface McpServerConfig {
  name: string;
  command: string;
  args: string[];
  env: EnvVar[];
}

/// All persisted app settings. Everything is optional/defaulted so a missing or
/// partial blob still yields a usable config.
export interface Settings {
  /// Absolute path to the engine's `dist/index.js`; overrides auto-resolution.
  enginePath?: string;
  /// The node binary to launch the engine with (default "node").
  nodePath?: string;
  /// Extra env merged into the engine spawn (e.g. a full PATH for Finder launch).
  env: EnvVar[];
  /// Preferred model/mode applied to each new session, when set.
  defaultModel?: string;
  defaultMode?: string;
  /// MCP servers passed to every session.
  mcpServers: McpServerConfig[];
}

export const defaultSettings: Settings = { env: [], mcpServers: [] };

const STORAGE_KEY = "claude-tauri.settings";

/// Load settings from localStorage, falling back to defaults on absent or
/// corrupt data. Never throws — a broken blob must not wedge startup.
export function loadSettings(storage: Pick<Storage, "getItem"> = localStorage): Settings {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings;
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return defaultSettings;
  }
}

/// Persist settings. Returns whether the write succeeded.
export function saveSettings(settings: Settings, storage: Pick<Storage, "setItem"> = localStorage): boolean {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

/// Coerce an untrusted parsed blob into a valid Settings (drops junk, keeps
/// well-formed fields). Arrays default to empty; strings are validated.
export function normalizeSettings(input: unknown): Settings {
  const raw = (input ?? {}) as Record<string, unknown>;
  return {
    enginePath: str(raw.enginePath),
    nodePath: str(raw.nodePath),
    env: envVars(raw.env),
    defaultModel: str(raw.defaultModel),
    defaultMode: str(raw.defaultMode),
    mcpServers: mcpServers(raw.mcpServers),
  };
}

/// Convert configured stdio servers into ACP `McpServer[]` for `session/new`.
/// Servers without a name or command are dropped (they can't be launched).
export function toMcpServers(configs: McpServerConfig[]): McpServer[] {
  return configs
    .filter((c) => c.name.trim() && c.command.trim())
    .map((c) => ({
      name: c.name.trim(),
      command: c.command.trim(),
      args: c.args,
      env: c.env,
    }));
}

/// Split a whitespace/newline-separated argument string into an argv list.
export function parseArgs(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/// Parse `KEY=VALUE` lines into env pairs (blank lines and keyless lines skipped;
/// values may contain `=`).
export function parseEnv(text: string): EnvVar[] {
  const vars: EnvVar[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    vars.push({ name: trimmed.slice(0, eq).trim(), value: trimmed.slice(eq + 1) });
  }
  return vars;
}

/// Render env pairs back to `KEY=VALUE` lines (for editing).
export function formatEnv(vars: EnvVar[]): string {
  return vars.map((v) => `${v.name}=${v.value}`).join("\n");
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function envVars(value: unknown): EnvVar[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((v) => {
    const name = typeof v?.name === "string" ? v.name : undefined;
    return name ? [{ name, value: typeof v?.value === "string" ? v.value : "" }] : [];
  });
}

function mcpServers(value: unknown): McpServerConfig[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((v) => {
    const server = toServerConfig(v);
    return server ? [server] : [];
  });
}

/// Validate one raw MCP server entry; null if it lacks a name or command.
function toServerConfig(v: Record<string, unknown>): McpServerConfig | null {
  const name = str(v?.name);
  const command = str(v?.command);
  if (!name || !command) return null;
  return { name, command, args: strArray(v?.args), env: envVars(v?.env) };
}

function strArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((a): a is string => typeof a === "string") : [];
}
