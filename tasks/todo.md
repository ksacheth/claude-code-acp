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

## Known debt (carry forward)

- `useAgent` cyclomatic complexity is over the Code Health threshold (14 vs 9),
  pre-existing before T6. Consciously accepted for M0: the complexity is
  cohesive lifecycle/guard logic, not a Brain Method. **Resolve in M3** by
  splitting connection-lifecycle from session-interaction (the multi-session
  work forces a session-manager abstraction anyway).
- Engine `node` binary is resolved from PATH; a Finder-launched `.app` won't
  inherit the shell PATH. Fine for dev launch; address with the M6 settings UI.
- Bundle is ~657 kB (highlight.js languages). Irrelevant for a local app;
  trim later if desired.
