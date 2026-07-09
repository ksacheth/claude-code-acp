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

## Known debt (carry forward)

- ~~`useAgent` cyclomatic complexity~~ — RESOLVED in M1-T2 by splitting into
  `useAgentConnection` + `useSessionActions`. Code Health gate now clean.
- Engine `node` binary is resolved from PATH; a Finder-launched `.app` won't
  inherit the shell PATH. Fine for dev launch; address with the M6 settings UI.
- Bundle is ~657 kB (highlight.js languages). Irrelevant for a local app;
  trim later if desired.
