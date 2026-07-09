# M5 Plan — Model, effort & commands

Source: `SPEC.md` §2 M5. Per-session model picker + effort/thinking switching,
and a slash-command autocomplete palette driven by `available_commands_update`.

## What the engine gives us (verified in `src/acp-agent.ts`)

The engine **unifies** mode, model, effort, agent, and fast-mode into a single
`configOptions: SessionConfigOption[]`:

- Delivered in the `session/new` **and** `session/load` responses (alongside the
  legacy `modes`), and updated live via the `config_option_update` notification
  (full array each time).
- Set via ONE request — `session/set_config_option { sessionId, configId, value }`
  → returns `{ configOptions }` (authoritative; captures cascades, e.g. the
  effort list changes when the model changes, and the model's effort is re-applied
  to the SDK).
- Each option: `{ id, name, description?, category, type: "select"|"boolean",
  currentValue, options[] }`. IDs: `mode` / `model` / `effort` / `agent` / `fast`.
  Categories: `mode` / `model` / `thought_level` / …
- Mode changes ALSO emit `current_mode_update` (the engine auto-switches mode
  when entering plan mode, etc.), so that channel must keep updating the mode
  option's `currentValue`.
- `configOptions` is emitted unconditionally — no client capability handshake
  needed. We keep `clientCapabilities: {}` so fast-mode arrives as a two-value
  select fallback we can render generically (no bespoke boolean toggle).

Slash commands: `available_commands_update { availableCommands: AvailableCommand[] }`
lists the agent's commands (`{ name, description, input?: { hint } }`). A command
is invoked by sending `/name args` as ordinary **prompt text** — the engine reads
`prompt[0].text` and dispatches on a leading `/` (verified at acp-agent.ts:1073).
So the palette only helps compose the text; sending is unchanged `sendPrompt`.

## Design decision — migrate the M2 mode switcher onto config options

The M2 mode switcher reads a bespoke `modes` field. Rather than add a **parallel**
model/effort mechanism (real duplication), migrate mode into the unified
`configOptions` path: model, effort, and agent then come for free through the
same code. One store field, one action, one request, one generic renderer.

## Tasks

### M5-T1 — Unified session config options (model, effort, mode, agent)

- `sessions.ts`: replace `modes?: SessionModeState` with
  `configOptions?: SessionConfigOption[]`. Actions: `create.configOptions`,
  `setConfig { configOptions }` (authoritative replace), and
  `patchConfig { configId, value }` (optimistic single-value patch).
  Routing: `config_option_update` → replace; `current_mode_update` → patch the
  `mode` option's currentValue.
- `session/config.ts` (pure, tested): `selectConfigs(options)` → renderable
  select configs with ≥2 options; `patchCurrentValue(options, id, value)`;
  `setModeValue(options, modeId)`.
- `useSessionActions.ts`: replace `setMode` with `setConfig(configId, value)` —
  optimistic `patchConfig`, then `session/set_config_option`, then authoritative
  `setConfig(response.configOptions)`. `newSession` stores `response.configOptions`.
- `useSessionHistory.ts`: `resumeInto` stores `response.configOptions`.
- `Header.tsx`: render each select config as a labeled dropdown (Mode/Model/
  Effort/Agent/Fast), replacing the modes-only `<select>`.
- **Accept:** switch model mid-session → the next turn uses it; effort switch
  sticks; mode still works (and plan-mode auto-switch still reflects).
- **Verify:** reducer tests (config replace, optimistic patch, mode patch via
  current_mode_update); config.ts helper tests; Header render test; a gated live
  test asserting set_config_option(model) round-trips a changed currentValue.

### M5-T2 — Slash command palette

- `sessions.ts`: store `commands?: AvailableCommand[]`; route
  `available_commands_update`.
- `session/commands.ts` (pure, tested): `matchCommands(commands, draft)` — for a
  draft whose first token is `/prefix`, the commands whose name starts with
  `prefix` (case-insensitive); `[]` otherwise. `commandName(cmd)`.
- `Composer.tsx`: when matches exist, render a palette above the input; ↑/↓ to
  move, Enter/Tab to accept (fills `/name ` ready for args), Esc to dismiss,
  click to accept. Sending is unchanged.
- **Accept:** typing `/` lists the agent's real command set; picking one and
  sending runs it.
- **Verify:** matchCommands tests; Composer palette render/interaction tests.

## Notes / out of scope

- Boolean config capability (native fast-mode toggle) — not advertised; fast
  mode renders via the select fallback. Fine for a personal tool.
- Structured command inputs beyond the freeform hint — the palette inserts the
  name and shows the hint; args are typed freeform (matches Zed).
- `session/set_mode` legacy request is dropped in favor of set_config_option.
