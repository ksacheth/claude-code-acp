# SPEC — Claude Tauri (Claude Desktop replacement)

Status: v0.1.0 shipped (M0–M6 complete) · Owner: sacheth · Last updated: 2026-07-10

## 1. Objective

A cross-platform desktop app that replaces Claude Desktop as the daily driver,
using `claude-agent-acp` (this repo) as the engine over the Agent Client
Protocol (ACP).

**Why it exists**

1. **Transparency** — Claude Desktop hides thinking blocks and restricts what
   is visible. This app shows everything the agent emits: thinking, tool
   calls, plans, token usage.
2. **Speed** — the ACP path is noticeably faster than Claude Desktop; the app
   must preserve that snappiness (native shell, streaming-first UI).
3. **Control** — both layers are owned here. If the UI needs something the
   agent doesn't expose, the agent gets patched (`src/`), not worked around.

**Primary user:** the author, who drives scope and priority — "does the author
need this" outweighs general-purpose polish when the two conflict. The repo is
public and MIT-licensed, though: it builds and ships for macOS, Windows, and
Linux (see §9), and forks/PRs are welcome (`CONTRIBUTING.md`).

**Non-goals**

- Code signing / notarization for other users' machines — installers are
  unsigned, so Gatekeeper/SmartScreen warnings on first launch are expected.
- Auto-update infrastructure beyond what Tauri gives for free.
- Replacing the terminal Claude Code CLI.
- Building a new agent — the engine is `claude-agent-acp`, patched as needed.

## 2. Product scope & acceptance criteria

The bar for switching off Claude Desktop is full parity on the features below.
They are built **feature-by-feature in milestone order**; Claude Desktop stays
the daily driver until all land.

### M0 — Walking skeleton

- Tauri app launches as a standalone macOS app (own window, dock icon).
- App spawns `node dist/index.js` (the ACP agent) as a child process and
  completes the ACP `initialize` handshake.
- One session against a chosen project directory; user sends a prompt and
  sees the streamed `agent_message_chunk` reply rendered as markdown.
- **Accept:** cold start to first usable prompt < 3s; kill/restart leaves no
  orphaned agent processes.

### M1 — Transparency core

- Thinking blocks: `agent_thought_chunk` streams into a visually distinct,
  collapsible block — visible by default (this is the founding feature).
- Cancel button wired to `session/cancel`; a cancelled turn settles cleanly.
- Token/cost visibility: `usage_update` rendered live (context size, tokens).
- **Accept:** a prompt with extended thinking shows the thinking text live,
  not after the fact; cancelling mid-stream never wedges the session.

### M2 — Tool calls & permissions

- `tool_call` / `tool_call_update` rendered with kind, title, status, and
  expandable raw input/output.
- Permission requests rendered as blocking prompts with all agent-provided
  options (allow, always-allow, reject); mode switcher for session modes
  (default / plan / acceptEdits / bypassPermissions) via `session/setMode`.
- File edits render as diffs (ACP `diff` tool-call content).
- Plan entries (`plan` update) rendered as a live checklist.
- **Accept:** an edit-heavy coding turn is fully auditable from the UI alone —
  every tool call, its result, and every permission decision visible.

### M3 — Multi-session & multi-project

- Sidebar of sessions; each session bound to its own project directory (cwd);
  multiple sessions active concurrently, switchable without losing streams.
- New-session flow: pick directory (or none for general chat).
- **Accept:** two sessions in different repos can both be mid-turn; switching
  tabs shows each one's live stream correctly.

### M4 — Resume & history

- `session/list` browser; resume past sessions (`resumeSession` /
  `loadSession`) with replayed transcript across app restarts.
- **Accept:** quit the app mid-project, relaunch, resume the session, and
  continue the conversation with context intact.

### M5 — Model, effort & commands

- Model picker and effort/thinking switching per session
  (`session/setModel`, session model state; see `docs/model-configuration.md`).
- Slash commands: `available_commands_update` populates an autocomplete
  palette; commands round-trip correctly.
- **Accept:** switch model mid-session and the next turn uses it; typing `/`
  lists the agent's real command set.

### M6 — MCP, skills & settings

- MCP servers configured per session/project and passed through ACP session
  setup; skills and custom agents work as they do in Zed/Claude Code.
- Minimal settings UI: default mode, default model, agent path, env.
- **Accept:** an MCP tool call from a user-configured server executes and
  renders like a built-in tool.

### Ongoing — engine hacks (`src/`)

When the app needs data the agent doesn't emit, patch the agent first,
UI second. Engine changes must not break ACP compatibility with Zed (the
agent remains a standard ACP agent usable by other clients).

## 3. Tech stack & constraints

- **Shell:** Tauri 2.x (Rust). Rust side owns agent process lifecycle
  (spawn/kill/respawn) and pipes ACP JSON-RPC over stdio.
- **Frontend:** TypeScript + React + Vite (default choice — swap is cheap at
  M0, expensive later). Markdown rendering with streaming support.
- **Engine:** `claude-agent-acp` from this repo (`npm run build` → spawn
  `dist/index.js`), Node ≥ 22 required on the machine.
- **Auth:** the agent uses Claude Code's stored credentials. When credentials
  are absent, the app launches the engine's supported browser-based
  `auth login --claudeai` flow, then reconnects the agent.
- **Protocol:** ACP via `@agentclientprotocol/sdk` types. Prefer standard ACP
  over private side-channels; if a private extension is unavoidable, isolate
  it and mark it clearly.

## 4. Project structure

```
claude-agent-acp/            # engine repo (fork; upstream = agentclientprotocol/claude-agent-acp)
├── src/                     # the ACP agent (engine) — patched as needed
├── docs/                    # engine docs (model-configuration.md, …)
└── claude-tauri/            # the desktop app — its OWN git repo, nested here
    ├── SPEC.md              # this file
    ├── src-tauri/           # Rust: process mgmt, stdio transport, Tauri config
    └── src/                 # frontend: React + TS
```

- The app is a **separate git repository** nested inside the engine checkout:
  app history stays independent, and engine patches stay rebase-able onto
  upstream. The engine repo must not track `claude-tauri/` (kept out via
  `.git/info/exclude` in the engine repo).

## 5. Commands

Engine (repo root):

- `npm run build` — compile agent to `dist/`
- `npm run test:run` — unit tests (vitest)
- `npm run check` — lint + format check

App (`claude-tauri/`):

- `npm run tauri dev` — run the app with hot reload
- `npm run tauri build` — produce this platform's installer (.app/.dmg,
  .msi/.exe, or .deb/.AppImage/.rpm)
- `npm test` — frontend unit tests (vitest)
- `cargo test` (in `src-tauri/`) — Rust-side tests

## 6. Code style

- Follow each layer's existing conventions: the engine keeps its current
  ESLint/Prettier setup (`npm run check` must pass); the app uses the same
  Prettier config; Rust uses `rustfmt` defaults + `clippy`.
- TypeScript strict mode everywhere; no `any` at module boundaries.
- Conventional Commits, lowercase types, no co-authors, no AI attribution.
- Comments explain constraints, not narration.

## 7. Testing strategy

- **Engine:** existing vitest suite is the gate — `npm run test:run` after any
  `src/` change; add tests for any behavior the app newly depends on.
- **App logic:** unit-test the protocol layer (ACP message parsing, session
  state reducers, stream assembly) with vitest — this is where regressions
  hurt. UI components get tests only where they encode logic (e.g. permission
  option rendering).
- **Rust:** unit tests for process lifecycle (spawn, kill, orphan cleanup).
- **End-to-end:** each milestone's acceptance criteria are verified manually
  against the real agent before the milestone is called done — no e2e
  automation tax unless regressions bite twice.
- Code Health safeguard runs on non-trivial changes before commits.

## 8. Boundaries

**Always**

- Run the engine test suite after touching `src/`.
- Keep engine patches minimal and upstream-compatible (standard ACP first).
- Keep app commits and engine commits separate.

**Ask first**

- Adding private protocol extensions between app and engine.
- Dependency additions/upgrades in the engine (`package.json`).
- Anything that changes engine behavior for other ACP clients (Zed).

**Never**

- Break the engine's ACP compatibility (it must keep working in Zed).
- Commit credentials, tokens, or session transcripts.
- Rewrite/refactor engine code unrelated to what the app needs.

## 9. Distribution

- `.github/workflows/release.yml` builds macOS (arm64 + Intel), Windows, and
  Linux installers plus signed updater artifacts via
  `tauri-apps/tauri-action` and publishes them to a GitHub Release. Trigger by
  pushing a full `vX.Y.Z` tag, or manually via `workflow_dispatch`.
- The updater uses the published `latest.json` asset from the latest GitHub
  Release. Keep `TAURI_SIGNING_PRIVATE_KEY` and the optional
  `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` in GitHub Actions secrets.
- Windows and Linux are build-verified by CI only; the engine spawn and
  runtime behavior on those platforms has not been exercised end-to-end.
  Treat non-macOS installers as unverified until someone runs one.
