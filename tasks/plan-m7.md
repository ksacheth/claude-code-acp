# M7 Plan — Project-grouped chat sidebar

Beyond `SPEC.md` §2 M0–M6 (all shipped). The sidebar becomes the whole session
browser: chats grouped under the project directory they belong to, a flat
`Chats` section for chats with no project, rename for both, and lazy resume.

**Status: M7 COMPLETE.** All five tasks landed, plus per-project hiding. 221 app
unit tests (up from 181) + 12 Rust (up from 6) + 628 engine, all green; app and
engine builds pass. Code Health: `App.tsx` improved (complexity 24 → 22),
`Sidebar.tsx` and `projectPrefs.ts` refactored clean; four findings consciously
overruled (see "Code Health decisions" at the end).

Inspiration: the Codex sidebar (collapsible project folders with their chats
nested) and the ChatGPT `Recents` list (chats with no project at all).

## The constraint that shapes this

`cwd` is **required** on `session/new` (ACP `NewSessionRequest`), and the Claude
SDK stores every conversation under `~/.claude/projects/<encoded-cwd>/`. A
directory-less session does not exist and cannot be faked without forking the
storage layer.

So "chat without a project" is a **presentation** concept, not a session kind:

- One designated **chats dir** (app-owned, `<appData>/chats`, configurable) is
  the no-project home. Sessions there render flat, with no folder header, and
  `+ New chat` skips the directory picker entirely.
- An **unlisted dirs** set lets any existing directory (`~`, `~/Downloads`) opt
  out of being shown as a project; its chats join the same flat section.

The chats dir is deliberately an empty app-owned folder: file tools still work,
but nothing leaks in and no stray `CLAUDE.md` changes behaviour. Defaulting it
to `~` would make the whole home directory one project and let the bucket
accumulate real work.

## What the engine/SDK already give us (verified)

- `session/list` returns `{ sessionId, cwd, title, updatedAt }` for every
  persisted session across all projects (`src/acp-agent.ts:1350`), so grouping
  by `cwd` needs no engine change.
- `title` is already the SDK's best title: user `/rename` custom title, else the
  auto summary, else the first prompt (`SDKSessionInfo.summary`).
- The engine already reads `customTitle` and pushes `session_info_update`
  (`src/acp-agent.ts:1383`), so a rename propagates to open sessions for free.
- `session/fork` and `session/delete` are already wired (`src/acp-agent.ts:6881`).
- Custom requests are first-class: the builder takes
  `onRequest(method, parser, handler)` for any method string, and client-side
  `ctx.request(method, params)` calls it. No `_meta` smuggling needed.

What is missing: **rename**. ACP has no `session/rename` (`acp.d.ts:27-39`), but
the SDK exports `renameSession(sessionId, title, options)`. That is a small
engine addition, exactly the "patch the engine when the UI needs more" case in
SPEC §1.

## The structural shift

Today the sidebar lists only *open* sessions (`Sidebar.tsx:57`) and everything
persisted hides behind `HistoryBrowser`. After M7 the sidebar renders from
`session/list`, so:

1. **The History modal retires** into a filter box at the top of the sidebar.
2. **Resume goes lazy.** `restoreAll` currently replays full history for every
   remembered tab, sequentially, at launch
   (`src/session/useSessionHistory.ts:56`). Only the active chat needs loading;
   the rest are list rows until clicked. Launch gets much faster.
3. **Persistence shrinks** from an open-session list to "which chat was
   showing", since every chat is now always visible in the tree.

Trade-off accepted: multiple tabs no longer pre-load on launch. With the full
history in the tree there is nothing to restore *to* any more, and a
never-prompted session has no file on disk worth restoring.

## Tasks

### M7-T1 — Engine: session rename

- Register `_claude/session/rename` with params `{ sessionId, title, cwd? }`:
  sanitize the title, call SDK `renameSession(sessionId, title, { dir })`,
  respond `{ title }`. `cwd` is optional because the sidebar can rename a chat
  it has never loaded; when absent, fall back to an open session's cwd, else let
  the SDK search all project dirs.
- Emit `session_info_update` when the session is open so the header and
  transcript retitle without a refetch.
- **Verify:** engine tests for the happy path, the not-open path, and a rejected
  rename (empty title) leaving state untouched.

### M7-T2 — Sidebar tree data model (pure)

- `session/projects.ts`: `buildSidebarTree({ persisted, open, aliases, chatsDir,
  unlistedDirs })` → `{ projects: ProjectGroup[], loose: ChatEntry[] }`.
  - Union persisted with open **by sessionId**; open-only entries (brand new, no
    file yet) still appear, flagged `open` with a `streaming` bit.
  - Title precedence: an engine-provided title on an open session wins (it is
    live), else the persisted title, else the cwd basename. Requires a
    `titleSource` bit on `SessionState` so the basename placeholder never beats a
    real persisted summary.
  - Sort chats by `updatedAt` desc, open-without-timestamp first; sort projects
    by their newest chat.
- `filterTree(tree, query)`: match chat titles and project labels, dropping
  emptied groups.
- `session/projectPrefs.ts`: localStorage `{ aliases: cwd → label, expanded:
  cwd[] }` with the load/save/normalize shape used by `openSessions.ts`.
- **Verify:** unit tests for grouping, bucketing, sorting, the title precedence
  rules, filtering, and prefs normalization.

### M7-T3 — Chats dir + unlisted dirs

- Rust `ensure_chats_dir(override: Option<String>) -> Result<String, String>`:
  resolve the override or `app_data_dir()/chats`, `create_dir_all`, return the
  absolute path. A Rust command rather than the fs plugin, since the shell
  already owns filesystem work and this needs no new capability.
- `Settings` gains `chatsDir?: string` and `unlistedDirs: string[]`, normalized
  like the rest; SettingsModal grows a "Chats" section.
- `newSession(cwd?)`: with a cwd, skip the picker. `+ New chat` passes the
  resolved chats dir; `+ Project` keeps the picker.
- **Verify:** Rust test for create-and-return (override and default); settings
  normalize tests.

### M7-T4 — Session list state + lazy resume

- `useSessionHistory` holds `list: SessionInfo[] | null` and `refreshList()`,
  refreshed on connect, at turn end (picks up newly generated titles), and after
  delete/rename/new.
- `openSessions.ts` → `lastSession.ts`: persist `{ id, cwd }` for the active
  chat only, tolerating the old `{ sessions, activeId }` blob so an existing
  install still restores.
- `useOpenSessionsPersistence` → `useLastSessionPersistence`; `restoreSessions`
  → `restoreLast`.
- `renameSession` action: request, then patch both the store and the cached list.
- **Verify:** lastSession normalize/migration tests; the existing sessions-store
  tests extended for the title action.

### M7-T5 — Sidebar UI

- `Sidebar.tsx` rewritten as the tree; `ProjectRow`, `ChatRow`, `RowMenu`
  extracted so no file carries the whole thing.
- Project rows: folder icon, disclosure, alias-aware label, hover `...` (rename
  alias, collapse) and a chat count. Collapsed by default except the active
  chat's project.
- Chat rows: title, relative time, streaming dot, hover `...` (rename, delete).
- Flat `Chats` section above the projects, no folder header.
- Hiding: a project's `...` offers Hide/Unhide, and a `Show N hidden` control at
  the bottom reveals them dimmed. Presentation only (a `hidden` list in
  `projectPrefs`), so nothing is deleted and the chats return with the project.
  A hidden project holding the active chat is always shown, since an invisible
  selection reads as a bug.
- Filter box at the top; `HistoryBrowser` deleted.
- **Verify:** component tests for group rendering, expand/collapse, filtering,
  rename commit/cancel, and that clicking an unloaded chat resumes it.

## Code Health decisions

Refactored in response to the safeguard: `useSessionHistory` (13 → 9) gained a
`withCtx` helper replacing five copies of the same connection guard;
`Sidebar.tsx` (12 → clear) dropped a duplicated expanded-check and moved a
project's rows into `ProjectGroup`; `projectPrefs.ts` (clear) split its
normalizer into `aliasMap`/`pathList`/`isRecord`; the chats settings fields moved
into `ChatsSettingsSection`. Adding hiding pushed `Sidebar.tsx` back to 10 and
then over 120 lines, fixed by extracting the nested empty-state ternary into a
tested `emptyMessage` and the fixed top into `SidebarHeader`.

Consciously overruled, all marginal and at or just over threshold:

- **`useAgent` 14 → 15.** A composition root: the count is `??`/`&&` in the
  returned object. The one added branch is the refresh-on-connect effect, which
  needs connection status. Moving it into `useSessionHistory` would push that
  file back over its own threshold, trading one finding for another.
- **`useLastSessionPersistence` at 9.** Nine decision points in 45 lines, every
  one a documented guard against a real race (double restore, transient empty
  state mid-reconnect, write dedupe). The two effects share `hydratedRef`, so
  splitting them would mean threading a ref between hooks.
- **`SettingsModal` LOC 134 → 139.** Down from 159 after the extraction; the
  remainder is the component call itself. `App.tsx` is the same story at +1 line
  for one new prop, reported `stable`.
- **`sessions.ts` mean complexity 4.25 → 4.38.** Reported `stable`, not a
  regression: one small `setTitle` case in a switch.

## Out of scope

- Fork from the row menu. `session/fork` is already wired, so this is cheap
  later, but it is not part of the ask.
- Pin/favourite. `SDKSessionInfo.tag` plus SDK `tagSession()` is the obvious
  primitive when it comes up.
- `session/list` pagination. The engine reads every session file per call; fine
  today, but the ACP request takes a cursor and the SDK option takes a `limit`
  if the launch-time call ever measures slow.
- Drag-and-drop between projects. A chat's project *is* its cwd, so moving one
  would mean copying the conversation into a different project dir.
