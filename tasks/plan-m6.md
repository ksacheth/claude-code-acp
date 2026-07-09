# M6 Plan — MCP, skills & settings

Source: `SPEC.md` §2 M6. MCP servers per session/project; skills & custom agents;
a minimal settings UI (default mode/model, agent path, env).

## What's already covered (verified) — shrinks the milestone

- **MCP tool calls render like built-in tools** — an MCP server's tool arrives
  as an ordinary `tool_call`/`tool_call_update`, already rendered by M2's
  ToolCall component. No new rendering.
- **Custom agents** — the engine surfaces them as the `agent` config option,
  already rendered by M5's generic config picker. No new UI.
- **Skills** — ride the existing surfaces: skill slash commands appear in the
  M5 command palette; skill execution streams as tool calls. No app work.

So M6's real work is MCP config plumbing + a persisted settings UI whose spawn
settings reach Rust.

## What the engine/shell give us (verified)

- `session/new.mcpServers: McpServer[]` is the STANDARD ACP field (not `_meta`).
  The engine accepts stdio (`{ name, command, args, env }`, no `type`), `http`,
  and `sse` variants (acp-agent.ts:3541). We pass the user's configured servers
  here (and on `session/load`).
- Config defaults (model/mode) apply via the standard `session/set_config_option`
  after create — no reliance on private `_meta.claudeCode.options`.
- Rust `agent_start(command, args, cwd)` spawns the engine; it does NOT yet set
  env or accept a configurable node path. A Finder-launched `.app` inherits no
  shell PATH, so `command: "node"` can fail — the settings env/agent-path fix
  this (the standing M0 debt).

## Persistence

`localStorage` in the WKWebView (persists across restarts; zero new deps). A pure
`settings.ts` wraps it: typed `Settings`, defaults, `loadSettings`/`saveSettings`
(tolerating absent/corrupt data), and `toMcpServers(configs)` → ACP `McpServer[]`.

```ts
interface Settings {
  enginePath?: string;   // dist/index.js override (else auto-resolved)
  nodePath?: string;     // node binary; default "node"
  env: EnvVar[];         // extra env merged into the engine spawn (e.g. PATH)
  defaultModel?: string;
  defaultMode?: string;
  mcpServers: McpServerConfig[];  // stdio: { name, command, args, env }
}
```

Settings reach the sub-hooks via a `settingsRef` owned by `useAgent` (same
pattern as `ctxRef`): read at the moment of action, so runtime edits apply to
the next session / next reconnect without re-render churn.

## Tasks

### M6-T1 — MCP servers per session

- `settings.ts` (pure, tested): types/defaults/load/save; `toMcpServers` (stdio
  config → ACP shape); env/args parsing helpers (`KEY=VALUE` lines, arg splitting).
- `useSettings.ts`: state seeded from `loadSettings`; `save` persists + updates.
- Wire `settingsRef.current.mcpServers` (via `toMcpServers`) into
  `useSessionActions.newSession` and `useSessionHistory.resumeInto` (replacing
  the hardcoded `[]`).
- **Accept (SPEC, live):** a configured stdio MCP server's tool executes and
  renders like a built-in tool.
- **Verify:** `toMcpServers` unit tests; a gated live test with a hand-written
  minimal stdio MCP "echo" server — configure it, prompt the agent to call it,
  assert a `tool_call` for that tool streams.

### M6-T2 — Settings UI + spawn env/path

- Rust: `agent_start` gains `env: Option<HashMap<String,String>>`, applied via
  `cmd.envs`. `spawn_agent` gains an env param. Rust test: env passthrough.
- `tauriChannel.startAgent`: take the engine command (`nodePath`), engine path
  (`enginePath` override), and env from settings.
- `useAgentConnection`: read spawn config from `settingsRef` at connect time.
- Defaults: `newSession` applies `defaultModel`/`defaultMode` via
  `set_config_option` after create (only when set and different).
- Settings UI: a modal (opened from the sidebar) editing agent path, node path,
  env, default model/mode, and the MCP server list (add/edit/remove). Save
  persists; a note explains engine-path/env changes take effect on reconnect.
- **Accept:** setting an absolute node path + PATH lets the engine spawn from a
  Finder launch; a chosen default model is active on the next new session.
- **Verify:** settings load/save/normalize unit tests; Rust env test; the
  settings form render test.

## Notes / out of scope

- http/sse MCP servers: the data model/`toMcpServers` can carry them, but the UI
  focuses on stdio (the npx-based common case); hand-editing covers the rest.
- Per-project (per-cwd) MCP scoping beyond the global list — later; the global
  list already satisfies "per session" (every session gets it).
- No secrets are persisted beyond what the user types into env/headers; these
  live in localStorage (acceptable for a personal single-user tool).
