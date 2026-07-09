# M0 — Todo

Plan: `tasks/plan.md` (approved: yes) — **M0 COMPLETE**

- [x] T1 — Scaffold Tauri 2 + React + TS + Vite app; dev window + .app build
- [x] T2 — Rust agent process bridge (spawn / stdin write / stdout events / clean kill)
- [x] T3 — TS ACP transport + `initialize` handshake; connection state in UI ◄ C1
- [x] T4 — Session + prompt + streamed reply end-to-end ◄ C2
- [x] T5 — Streaming-stable markdown rendering
- [x] T6 — Lifecycle hardening; M0 acceptance checks pass ◄ C3 (M0 done)

## M0 acceptance gate — all verified

- [x] Cold start → first usable prompt < 3s (steady-state ~0.6–1.1s; first-run-after-build ~4s is a one-time macOS verification cost)
- [x] No orphaned agent processes after 3× force-quit (engine EOF-exit cleans up even under SIGKILL)
- [x] Agent crash surfaces disconnect + reconnect in UI (app survives engine kill)

## M1 — Transparency core (COMPLETE)

- [x] M1-T1 — visible thinking blocks (collapsible, expanded by default)
- [x] M1-T2 — cancel in-flight turns (settles as cancelled, partial output kept)
- [x] M1-T3 — live token/cost in the header
- Live acceptance: streaming reply, thinking, and cancel all pass against the
  real engine (gated suite, `RUN_LIVE_PROMPT=1`).

## M2 — Tool calls & permissions (COMPLETE)

- [x] M2-T1 — tool calls + LCS file diffs (kind/status/expandable raw io)
- [x] M2-T2 — permission prompts (modal with the agent's real options)
- [x] M2-T3 — session mode switcher (Manual/Auto/Accept Edits/Plan/…)
- [x] M2-T4 — live plan checklist
- Live acceptance: gated suite adds a tool-call test (permission granted); a
  multi-step task streams plan + tool calls + thinking + usage in one turn.
- Architecture: session updates routed by a pure `routeSessionUpdate`
  (usage/mode/plan/transcript); permission resolved via a ref-held resolver.

## M3 — Multi-session & multi-project (COMPLETE)

- [x] M3-T1 — sessions store reducer (per-session transcript/usage/mode/plan)
- [x] M3-T2 — hooks wired to the store; updates routed by sessionId
- [x] M3-T3 — session sidebar + switching (two-column shell)
- Architecture: ONE agent process hosts N sessions; `sessionsReducer` keys all
  per-session state by id. Live-verified: two concurrent turns on one
  connection stream isolated replies.

## M4 — Resume & history (COMPLETE)

- [x] M4-T1 — session/list + load with history replay; setModes + title updates
- [x] M4-T2 — history browser modal (relative time, resume)
- Acceptance (live): a session created + prompted in one process was loaded in a
  FRESH process with its transcript replayed (codeword recovered).
- Architecture: create-before-load so replayed updates route by id; a separate
  `useSessionHistory` hook owns list/resume.

## M5 — Model, effort & commands (COMPLETE)

- [x] M5-T1 — unified config options (model/effort/mode/agent) via
  session/set_config_option; header renders each multi-option select
- [x] M5-T2 — slash command palette (available_commands_update → `/` autocomplete)
- Acceptance (live): set_config_option(model) round-trips a changed currentValue;
  session/new announces the agent's command set.
- Architecture: migrated the M2 mode switcher onto the engine's unified
  `configOptions` (one field, one action, one request, generic renderer) rather
  than a parallel model/effort mechanism; palette state machine in a
  `useCommandPalette` hook over pure match/navigation helpers.

## M6 — MCP, skills & settings (COMPLETE)

- [x] M6-T1 — MCP servers per session: persisted config passed through the
  standard session/new & load `mcpServers`; MCP tool calls render like built-ins.
  Default mode/model applied per new session via set_config_option.
- [x] M6-T2 — Settings UI (localStorage): node/engine path, spawn env, default
  model/mode, MCP server list. Rust `agent_start` applies env to the child.
- Skills & custom agents: no app work — skill commands ride the M5 palette,
  custom agents the M5 agent picker, MCP/skill tool calls the M2 renderer.
- Acceptance (live): a user-configured stdio MCP echo server's tool executed
  and rendered as a tool call. Rust test: env passthrough to the child.

## Known debt (carry forward)

- ~~`useAgent` cyclomatic complexity~~ — RESOLVED in M1-T2.
- ~~Finder-launched `.app` PATH gap~~ — RESOLVED in M6-T2: settings env feeds
  the spawn (`agent_start` applies it); set a full PATH (and/or an absolute node
  path) in Settings for a packaged launch.
- Bundle is ~674 kB (highlight.js languages). Irrelevant for a local app;
  trim later if desired.
- MCP UI covers stdio servers (the npx common case); http/sse are in the data
  model but not the form — hand-edit localStorage or extend the form later.
