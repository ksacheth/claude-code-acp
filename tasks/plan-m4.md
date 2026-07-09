# M4 Plan — Resume & History

Source: `SPEC.md` §2 M4. Browse past sessions and resume them with a replayed
transcript across app restarts.

## What the engine gives us (verified)

- `session/list { cwd? }` → `{ sessions: SessionInfo[] }` where SessionInfo =
  `{ sessionId, cwd, title?, updatedAt }`. Omit cwd to list every persisted
  session. Sessions are SDK-persisted on disk, so they survive app restarts.
- `session/load { sessionId, cwd, mcpServers }` → **replays the full history**
  as `session/update` notifications (message/thought chunks, tool calls, …)
  before resolving, then returns modes like `session/new`.
- `session_info_update { title?, updatedAt? }` — live title changes (the SDK
  auto-generates a title; `/rename` sets a custom one).

## The replay ordering (the crux)

`session/load` streams the history updates tagged with the sessionId. Our
sessionsReducer routes updates by id and no-ops for unknown ids. So the store
session **must exist before the replay arrives**:

1. `dispatch(create(sessionId, cwd))` — we know the id (we're loading a
   specific one from the list).
2. `await session/load({ sessionId, cwd, mcpServers: [] })` — replayed updates
   now route into the created session, rebuilding its transcript.
3. `dispatch(setModes(sessionId, response.modes))` — modes from the response.
4. `dispatch(activate(sessionId))`.

## Tasks

### M4-T1 — Resume core (reducer + hook)

- Reducer: handle `session_info_update` (update the session's title) and a new
  `setModes` action (attach modes after load). Guard `create` so re-creating an
  already-open session is a no-op (don't duplicate/blank it).
- Hook: `listSessions()` → `SessionInfo[]`; `resumeSession(info)` implementing
  the ordering above. Skip resuming a session that is already open (just
  activate it).
- **Accept:** create a session, prompt it, then resume it fresh and see the
  replayed transcript; title updates land.
- **Verify:** reducer tests (title update, setModes, create-idempotency); a
  gated live test that prompts a session, loads it in a second connection, and
  asserts the replayed transcript contains the earlier exchange.

### M4-T2 — History browser UI

A "History" affordance in the sidebar opens a modal listing past sessions
(title, cwd, relative time), most-recent first; clicking resumes. Refreshes on
open. Already-open sessions are marked/activated rather than reloaded.

- **Accept (SPEC):** quit mid-project, relaunch, open history, resume the
  session, and continue with context intact.
- **Verify:** browser render test (list, empty state); manual restart→resume.

## Notes

- Relative-time formatting is a small pure helper (tested).
- Out of scope: pagination (nextCursor) — list the first page; note if
  truncated. Deleting/renaming sessions is later.
