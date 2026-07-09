# M0 — Todo

Plan: `tasks/plan.md` (approved: no)

- [ ] T1 — Scaffold Tauri 2 + React + TS + Vite app; dev window + .app build
- [ ] T2 — Rust agent process bridge (spawn / stdin write / stdout events / clean kill)
- [ ] T3 — TS ACP transport + `initialize` handshake; connection state in UI ◄ C1
- [ ] T4 — Session + prompt + streamed reply end-to-end ◄ C2
- [ ] T5 — Streaming-stable markdown rendering
- [ ] T6 — Lifecycle hardening; M0 acceptance checks pass ◄ C3 (M0 done)

## M0 acceptance gate

- [ ] Cold start → first usable prompt < 3s
- [ ] No orphaned agent processes after 3× force-quit
- [ ] Agent crash surfaces disconnect + restart in UI
