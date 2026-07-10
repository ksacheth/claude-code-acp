# Contributing

Claude Tauri is a personal desktop client, maintained by one person for one
person's daily use (see `SPEC.md`). It's public and MIT-licensed, so forks,
bug reports, and PRs are welcome — just know that scope decisions favor "does
the author need this" over general-purpose flexibility.

## Setup

This app is a thin native shell around the `claude-agent-acp` engine in the
parent repo. You need both:

```bash
# from the parent repo root: build the engine
npm install && npm run build

# from claude-tauri/: install and run the app
npm install
npm run tauri dev
```

If the app can't find the engine, either run it from inside a checkout of the
parent repo (auto-resolved), set `CLAUDE_TAURI_ENGINE=/path/to/dist/index.js`,
or set the engine path in the app's own Settings.

## Tests

```bash
npm run test:run   # unit tests — no external dependencies
cd src-tauri && cargo test   # Rust process/spawn tests
```

Two test files talk to a real built engine and skip themselves automatically
if it's not present:

- `src/acp/connection.integration.test.ts` — runs if `../dist/index.js` exists
- `src/acp/connection.live.test.ts` — additionally requires
  `RUN_LIVE_PROMPT=1` (it prompts a real model and costs real tokens)

## Before opening a PR

- `npx tsc --noEmit` and `npm run test:run` should pass.
- `npm run tauri build` should still produce a working bundle.
- Keep changes scoped — this is a small app on purpose.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/), lowercase type,
short title, details in the body: `feat(app): add X`, `fix(app): handle Y`.
