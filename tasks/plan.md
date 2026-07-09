# M0 Plan — Walking Skeleton

Source: `SPEC.md` §2 M0. Status: awaiting approval.

**Goal:** Tauri 2 macOS app that spawns `claude-agent-acp`, completes the ACP
handshake, and streams one markdown-rendered chat reply for a chosen project
directory. Cold start → first usable prompt < 3s; zero orphaned agent
processes after kill/restart.

## Architecture decision (made now because every task depends on it)

**The ACP client lives in the TypeScript frontend; Rust is a dumb pipe.**

- Rust (`src-tauri/`): spawn `node <engine>/dist/index.js`, forward stdout
  lines to the webview as Tauri events, expose a command to write lines to
  stdin, kill the child reliably on exit. Nothing protocol-aware.
- Frontend: bridge Tauri IPC into the Web streams that
  `@agentclientprotocol/sdk`'s `ndJsonStream` + `acpClient` expect — the exact
  pattern already proven in the engine's own tests
  (`src/tests/acp-agent.test.ts:279-321`).

Why: the typed ACP SDK is TypeScript; reimplementing JSON-RPC + ACP types in
Rust duplicates the engine's type surface and makes every future engine hack
a two-language change. Rust stays ~200 lines of process plumbing.

Facts from the engine that shape the plan:

- Agent exits on stdin EOF (`src/index.ts:73-76`) — orphan prevention is
  cooperative: the app closing the child's stdin is sufficient; hard-kill is
  the backstop.
- `initialize` requires `protocolVersion: 1` + `clientCapabilities`; agent
  replies with `agentInfo` and capabilities (`src/acp-agent.ts:765`).
- `session/new` needs `{ cwd, mcpServers: [] }`; commands update arrives as a
  follow-up notification.
- During a prompt the agent may call back: `session/request_permission`,
  `fs/read_text_file`, `fs/write_text_file`. M0 advertises **no** fs
  capability and answers permission requests with `{ outcome: "cancelled" }`
  (logged visibly) — real permission UI is M2 by spec.

## Dependency graph

```
T1 scaffold ──► T2 rust process bridge ──► T3 handshake slice ──► T4 chat slice ──► T6 lifecycle & perf
                                                                    └─► T5 markdown rendering
```

Checkpoints: **C1** after T3 (protocol proven), **C2** after T4 (end-to-end
reply — the heart of M0), **C3** after T6 (acceptance criteria = milestone
done).

## Tasks

### T1 — Scaffold the app

Create the Tauri 2 + React + TS + Vite app in `claude-tauri/` (this repo
root), macOS-only config, window titled "Claude Tauri".

- **Accept:** `npm run tauri dev` opens an empty native window; `npm run
  tauri build` produces a launchable `.app`.
- **Verify:** run both commands; app appears in dock with its own icon.

### T2 — Rust: agent process + stdio bridge

Tauri state holding the child process. Commands: `agent_start(engine_path)`,
`agent_send(line)`, `agent_stop()`. Child stdout is read line-by-line and
emitted as `agent-stdout` events; stderr forwarded to a log; child exit
emitted as `agent-exit`. Drop/window-close closes stdin then kills after a
grace period.

- **Accept:** from the webview devtools console, sending a raw
  `initialize` JSON-RPC line yields the agent's JSON response as an event.
- **Verify:** manual devtools round-trip; `cargo test` for spawn/kill/
  stdin-EOF unit tests; `ps` shows no `node` child after window close.

### T3 — Handshake slice (first vertical proof)

TS transport: adapt Tauri events/commands into `ReadableStream`/
`WritableStream`, feed `ndJsonStream` + `acpClient`. Register handlers:
`session/update` (buffer to console for now), `session/request_permission`
(auto-cancel + log). Call `initialize` on app start; render connection state
and `agentInfo.version` in the UI.

- **Accept:** app launch shows "Connected — claude-agent-acp vX.Y.Z" with no
  manual steps; agent crash shows "Disconnected".
- **Verify:** vitest on the transport bridging (stream framing, backpressure,
  partial lines); manual launch check. **Checkpoint C1.**

### T4 — Chat slice: session + prompt + streamed reply

Directory picker (Tauri dialog) → `session/new { cwd, mcpServers: [] }` →
prompt input → `session/prompt` → render `agent_message_chunk` text live into
a transcript; turn ends on prompt response (`stopReason`). Plain text is fine
here; thinking chunks may arrive — buffer and ignore for M0 (M1 renders them).

- **Accept:** type "say hi", watch the reply stream in token-by-token, in a
  session rooted at a real project dir.
- **Verify:** vitest on the session-state reducer (chunk assembly, turn
  lifecycle); manual end-to-end prompt. **Checkpoint C2.**

### T5 — Markdown rendering

Render transcript messages as GitHub-flavored markdown (code blocks with
highlighting) that stays stable while streaming (no flicker/re-layout jank).

- **Accept:** a reply containing headings, a fenced code block, and a list
  renders correctly while still streaming.
- **Verify:** manual prompt "reply with a markdown sample"; snapshot test of
  the renderer on a fixed markdown fixture.

### T6 — Lifecycle hardening & the M0 acceptance bar

Engine path resolution (setting/env, default `../dist/index.js`), respawn-on-
crash with UI surface, kill-on-quit verified, cold-start measurement.

- **Accept (M0 gate, from SPEC):**
  1. cold start → first usable prompt < 3s (measured, logged at startup);
  2. force-quit the app 3×, `pgrep -f "dist/index.js"` finds nothing;
  3. kill the agent process manually → UI shows disconnect and offers restart.
- **Verify:** run the three checks above literally; `cargo test` +
  `npm run test:run` (app) green. **Checkpoint C3 — M0 done.**

## Out of scope for M0 (explicitly)

Thinking blocks (M1), tool-call rendering & real permissions (M2),
multi-session (M3), resume (M4), model switching (M5), MCP config (M6).
No engine (`src/`) changes expected in M0 — first engine hack likely lands
in M1 only if thinking data proves insufficient.

## Risks

- **Tauri IPC throughput** for high-frequency stream chunks — if event-per-
  line is too chatty, batch lines in Rust (known pattern, contained in T2).
- **`@agentclientprotocol/sdk` in a browser context** — it's used with Node
  streams in tests; if Node-isms leak in, wrap or vendor the ndjson framing
  (contained in T3, fallback is ~50 lines of hand-rolled JSON-RPC).
- **Cold start < 3s** — engine is a Node process that itself spawns the SDK;
  if handshake is slow, pre-spawn the agent at app launch before any UI
  interaction (already the T3 design).
