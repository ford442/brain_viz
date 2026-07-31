# Contributing to Neuro-Weaver

This file is a map of "where to look" — the repo has grown a lot of documentation, and this points you at the one canonical doc for each topic.

## Where to look

| Topic | File |
|---|---|
| Getting started, quick start, visualization modes | [`README.md`](README.md) |
| Comprehensive project/architecture guide (for AI agents and humans) | [`AGENTS.md`](AGENTS.md) |
| Claude Code-specific guardrails | [`CLAUDE.md`](CLAUDE.md) |
| GitHub Copilot-specific guardrails | [`.github/copilot-instructions.md`](.github/copilot-instructions.md) |
| Grok-specific guardrails | [`docs/grok-agent-guide.md`](docs/grok-agent-guide.md) |
| Roadmap, phase history, open items, dream backlog | [`docs/ROADMAP.md`](docs/ROADMAP.md) |
| Live Muse/OpenBCI devices, bridge, recording, routine events | [`docs/bci-device.md`](docs/bci-device.md) |
| Immersive VR/AR setup, controls, routine integration | [`docs/webxr.md`](docs/webxr.md) |
| Module-by-module architecture | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| Complexity hotspots, dependency flows, gotchas | [`docs/DEVELOPER_CONTEXT.md`](docs/DEVELOPER_CONTEXT.md) |
| Scientific accuracy of physiological models | [`docs/SCIENTIFIC_ACCURACY_REPORT.md`](docs/SCIENTIFIC_ACCURACY_REPORT.md) |
| SynaptiX comparative mode | [`docs/synaptix.md`](docs/synaptix.md), [`docs/SYNAPTIX_SPEC.md`](docs/SYNAPTIX_SPEC.md) |
| WebGL2 fallback/debug renderer | [`docs/webgl-fallback.md`](docs/webgl-fallback.md) |
| C++/WASM hybrid simulation engine | [`docs/wasm-engine.md`](docs/wasm-engine.md) |
| Double Mirror `.nwsession` capture/replay format and privacy boundary | [`docs/session-format.md`](docs/session-format.md) |
| Double Mirror implemented V1 and longer-term vision | [`docs/DOUBLE_MIRROR_VISION.md`](docs/DOUBLE_MIRROR_VISION.md) |
| Superseded/historical planning docs | [`docs/archive/`](docs/archive/) |

If two of the above ever disagree, `AGENTS.md` is the tie-breaker; the agent-specific guardrail files (`CLAUDE.md`, `.github/copilot-instructions.md`, `docs/grok-agent-guide.md`) are kept in sync with it, not the other way around.

## Quick commands

```bash
npm install
npm run dev                       # dev server, http://localhost:5173
npm run build                     # web-only production build
python3 scripts/test_run.py       # smoke test
python3 verification/verify_suite.py   # full visual verification suite (WebGL fallback)
python3 scripts/deploy.py         # deploy dist/ via SFTP
```

## Code style

Pure vanilla JavaScript (ES Modules, no TypeScript), no frameworks, `camelCase`/`PascalCase` naming, `// [Neuro-Weaver]` or `// [Phase N]` tags on subsystem-level comments. See `AGENTS.md` §6 for the full style guide.

## No automated unit tests

Testing is manual/visual for rendering changes, plus the Playwright-based `verification/` suite (WebGL2 fallback) for CI. See `AGENTS.md` §7.
