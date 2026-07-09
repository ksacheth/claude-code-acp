# M1 Plan — Transparency Core

Source: `SPEC.md` §2 M1. The founding milestone: make visible what Claude
Desktop hides. Built on M0's transcript/hook/transport.

## What the engine gives us (verified)

- `agent_thought_chunk` — same `ContentChunk` shape as `agent_message_chunk`;
  text at `update.content.text`. Streams live during extended thinking.
- `usage_update` — `{ used, size, cost?: { amount, currency } }`: tokens in
  context, context-window size, optional cumulative cost. Session-scoped.
- `session/cancel` — a **notification** (`ctx.notify`). Sending it settles the
  in-flight `session/prompt` with `stopReason: "cancelled"`, so our existing
  `finally { dispatch end }` closes the turn.

## Tasks

### M1-T1 — Thinking blocks

Extend the transcript so each assistant message carries a `thought` string
(accumulated from `agent_thought_chunk`), rendered above the answer in a
collapsible block, expanded by default. Thought text is plain (not markdown)
and streams live with a caret while the turn is active.

- **Accept:** a prompt that triggers extended thinking shows thinking text
  streaming live, collapsible, before/while the answer streams.
- **Verify:** reducer tests (thought accumulation, independent of answer text);
  manual live prompt. Extend the gated live test to assert a thought arrived.

### M1-T2 — Cancel

A Cancel button shown while a turn is active; sends `session/cancel` for the
session. The turn settles cleanly (existing finally), the streaming caret
stops, partial output is preserved.

- **Accept:** start a long turn, hit Cancel, the turn stops promptly and the
  UI returns to idle with partial text kept.
- **Verify:** hook wiring + a test that cancel calls notify with the session id;
  manual mid-stream cancel.

### M1-T3 — Live token / cost

Track the latest `usage_update` as session state in the hook; render tokens
(used / size, with a context-used %) and cost (if present) live in the header.

- **Accept:** during and after a turn, the header shows context usage updating
  live; cost appears when the engine reports it.
- **Verify:** a small pure formatter tested (tokens, %, currency); manual.

## Out of scope for M1

Tool-call rendering & real permissions (M2), multi-session (M3). No engine
(`src/`) change expected — all three signals are already emitted.

## Debt to address here if cheap

`useAgent` cyclomatic — M1 adds usage + cancel to the hook, nudging it further.
If it grows materially, extract a `useUsage`/routing helper; otherwise keep the
connection/session split for M3 as planned.
