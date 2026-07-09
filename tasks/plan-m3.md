# M3 Plan — Multi-Session & Multi-Project

Source: `SPEC.md` §2 M3. A sidebar of sessions, each bound to its own project
directory (cwd); multiple sessions active concurrently, switchable without
losing streams.

## Key architecture fact (verified)

The engine keeps `this.sessions` keyed by sessionId and stamps every
`session/update` with its `sessionId`. So **one agent process hosts many
sessions**. M3 keeps the single connection/process from M0–M2 and routes
updates by sessionId. No per-session process — the M1 connection/session split
was built for exactly this.

## State model change

Today per-session state is singular: one `transcript` reducer plus `usage`,
`modes`, `plan`, `cwd`, `sessionId` in the hooks. M3 makes it plural.

New `sessionsReducer` owns `{ sessions: Record<id, SessionState>, activeId }`:

```
SessionState = {
  id, cwd, title,            // title from cwd basename (session_info_update later)
  transcript: TranscriptState,   // messages + turnActive (per session)
  usage?, modes?, plan?,
}
```

- Update routing (usage/mode/plan/transcript) moves *inside* the reducer,
  scoped per session by the notification's sessionId — replacing the separate
  `routeSessionUpdate` + top-level usage/plan/mode state.
- Actions carry a sessionId (`submit`/`end`/`update`/`create`/`activate`/…).
- The connection layer (ctxRef, status, permission) is unchanged — it is
  session-agnostic.

## Tasks

### M3-T1 — Sessions reducer (the state core)

Pure `sessionsReducer` managing all sessions keyed by id, with actions:
create, activate, remove, submit, end, and update (routing chunk/tool →
transcript, usage/mode/plan → that session's fields). Reuse the existing
transcript reducer per session. Derive `title` from the cwd basename.

- **Accept:** two sessions accumulate independent transcripts/usage/plan; an
  update stamped with session B never touches session A.
- **Verify:** reducer tests (isolation, active switching, per-session turn
  state, routing by sessionId).

### M3-T2 — Wire hooks to the store

Rework `useSessionActions` → session-aware: `newSession` (pick dir →
session/new → create+activate), and `sendPrompt`/`cancel`/`setMode` target the
**active** session id. `useAgent` swaps single transcript/usage/plan for the
sessions store; update routing dispatches by `notification.sessionId`.

- **Accept:** existing single-session behavior is unchanged when only one
  session exists; the app still passes all prior live tests.
- **Verify:** default suite green; a gated live test runs two sessions.

### M3-T3 — Sidebar + switching UI

A left sidebar listing sessions (title + cwd, active highlighted, turn spinner),
a "+ New session" button, and click-to-switch. The main pane renders the active
session's transcript/plan/composer/mode/usage.

- **Accept (SPEC):** two sessions in different repos can both be mid-turn;
  switching tabs shows each one's live stream correctly.
- **Verify:** sidebar render test; manual/live two-session concurrency check.

## Notes

- Concurrency: the engine handles concurrent `session/prompt`s across sessions;
  each turn's completion is tracked per session (turnActive lives in each
  SessionState). Cancel/permission are per active session (permission carries a
  sessionId — route the modal to the right session, but a single modal is fine
  for M3 since prompts block on their own turn).
- Watch Code Health as the reducer grows; keep per-concern helpers (a
  per-session update applier) like M2's routeSessionUpdate.
- Out of scope: resume/history across restarts (M4).
