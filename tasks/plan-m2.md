# M2 Plan — Tool Calls & Permissions

Source: `SPEC.md` §2 M2. Make a coding turn fully auditable: every tool call,
its result, every permission decision, diffs, and the plan — all visible.

**Status: M2 COMPLETE.** All four tasks landed. A single live multi-step task
was observed streaming plan updates, tool calls, thinking, and usage together —
the whole M2 surface through one turn. Code Health gate clean.

## What the engine gives us (verified)

- `tool_call` — `{ toolCallId, title, kind?, status?, content?, locations?,
  rawInput?, rawOutput? }`. `kind`: read|edit|delete|move|search|execute|think|
  fetch|switch_mode|other. `status`: pending|in_progress|completed|failed.
- `tool_call_update` — same fields, all optional except `toolCallId`; merge by id.
- `ToolCallContent` — `{type:"content", ...}` | `{type:"diff", path, oldText?,
  newText}` | `{type:"terminal", ...}`.
- `session/request_permission` (client request) — `{ sessionId, toolCall,
  options: PermissionOption[] }`; respond `{ outcome: {outcome:"selected",
  optionId} | {outcome:"cancelled"} }`. Option kinds: allow_once, allow_always,
  reject_once, reject_always.
- Session modes — `NewSessionResponse.modes: { currentModeId, availableModes:
  {id,name,description?}[] }`; change with `session/set_mode {sessionId,modeId}`;
  the agent echoes `current_mode_update`.
- `plan` — `{ entries: {content, priority, status}[] }`; the client replaces the
  whole plan each update. status: pending|in_progress|completed.

## Model change

Assistant `Message` gains `toolCalls: ToolCallView[]` (merged by id within the
turn). Plan and current mode are session-level state in `useAgent` (like usage).
Tool-call ordering is grouped under the assistant message (faithful interleaving
of text-vs-tool is a later refinement; M2's bar is "all visible").

## Tasks

### M2-T1 — Tool calls + diffs

Reduce `tool_call` / `tool_call_update` into the open assistant message's
`toolCalls` (create on first sight, merge partial updates by id). Render each
with a kind icon, title, status, and an expandable body: raw input/output
(JSON) and content — text blocks and **diffs** (path + old→new, line-level).

- **Accept:** an edit turn shows each tool call with status transitions and the
  file diff inline.
- **Verify:** reducer tests (create, merge status/content, multiple calls);
  diff-view snapshot; gated live test asserting a tool call arrives.

### M2-T2 — Permission prompts

`connectAgent` gains an `onPermissionRequest` handler; the hook holds a pending
request and resolves it when the user picks. Modal shows the tool + all options
(allow once/always, reject once/always); resolve with the selected optionId, or
cancelled if the turn aborts.

- **Accept:** a tool needing permission blocks with a prompt; choosing an option
  resolves it and the turn continues/《stops accordingly.
- **Verify:** unit test option→outcome mapping and abort→cancelled; manual.

### M2-T3 — Session mode switcher

Read `modes` from `session/new`; render a selector (default / plan / acceptEdits
/ bypassPermissions per the engine); `session/set_mode` on change; keep in sync
with `current_mode_update`.

- **Accept:** switching to plan/acceptEdits changes how permissions behave on the
  next turn; the selector reflects agent-driven mode changes.
- **Verify:** mode-state reducer test; manual.

### M2-T4 — Plan checklist

Reduce `plan` updates into session state; render a live checklist with per-entry
status (pending/in_progress/completed).

- **Accept:** a planning turn shows the checklist updating as entries complete.
- **Verify:** plan-state test; manual.

## Notes

- No client fs capability needed: the engine's SDK does its own file I/O; diffs
  arrive as tool-call content. Keep advertising no fs for M2.
- Watch `useAgent`/reducer Code Health as tool-call handling grows; extract as in
  M1 rather than letting a function drift over threshold.
