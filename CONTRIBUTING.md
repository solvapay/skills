# Contributing to solvapay/skills

Maintainer notes that do not belong inside a skill. Everything under `skills/` ships to end users (via `npx skills add`, the Claude Code plugin and the release archives), so keep internal tooling, dev backends and preview tags out of SKILL.md and its references.

## Layout

- `skills/<name>/` — one folder per skill: `SKILL.md`, optional `references/` and `scripts/`. Links inside a skill point only at files in that folder, never at repo paths such as `../../evals/`.
- `evals/<name>/` — trigger and output evals; see [evals/README.md](evals/README.md).
- `scripts/` — repo tooling (`dev-link.mjs`, the release build).

## Versioning

`metadata.version` in each SKILL.md frontmatter is bumped whenever that skill's content changes (minor for new behaviour, patch for fixes). The repo-level release tag (`vX.Y.Z`) versions the whole set; the per-skill version lets a client see which skills changed between releases.

## Docs source

Skills look facts up rather than hard-coding them. The shared chain is: SolvaPay Docs MCP at `https://docs.solvapay.com/mcp` (HTTP transport, no auth) → `https://docs.solvapay.com/llms.txt` → a direct page fetch. Keep that chain, in that order, in any new skill.

## Dev mode (internal testing against api-dev)

Never put any of this in a skill. End users must never be sent to `api-dev.solvapay.com` or to `@preview` dist-tags.

The SolvaPay dev backend is `https://api-dev.solvapay.com`. It rejects production keys. To run a skill against it:

- Published CLI: append `--dev` to `npm create solvapay@preview <name> -- --type mcp` and `npx -y solvapay@preview init`. Use the `@preview` dist-tag, not `@latest`, so the CLI matches the preview scaffolder. Both write `SOLVAPAY_API_BASE_URL=https://api-dev.solvapay.com` into the project `.env`.
- Agent path (create-mcp-app wrappers): `npm install create-solvapay@preview` in the skill directory, then `node scripts/describe.mjs --dev …`, `node scripts/scaffold.mjs --dev … --selections …`. The wrappers strip `--dev` before calling the upstream scripts, set `SOLVAPAY_API_BASE_URL` for the run, and `scaffold.mjs --dev` seeds it into the generated `.env`.
- No scaffolder in the loop (hand-written server, or a prompt that fixes `.env`): set `SOLVAPAY_API_BASE_URL=https://api-dev.solvapay.com` yourself and read it via `env.SOLVAPAY_API_BASE_URL` / `process.env.SOLVAPAY_API_BASE_URL`.
- `deploy.mjs` in a scaffolded project forwards `SOLVAPAY_API_BASE_URL` from `.env` as a `--var` override, and the preflight `GET /v1/sdk/merchant` hits the same origin.

Stable vs preview is the trap: api-dev needs the preview CLI and scaffolder in lockstep. `resolve-scaffolder.mjs` warns when it sees a stable build under a dev backend, or a `-preview` scaffolder with no dev signal. Pin `@preview` at install time for dev runs and reinstall `@latest` afterwards; do not leave a stale `scripts/node_modules/create-solvapay` in the skill directory, because resolution can pick it ahead of `@latest`.

Evals: the harness sets `EVAL_DEV_MODE=1` to append `dev_mode_suffix` from `evals/create-mcp-app/evals.json` to every prompt. That suffix carries the full dev-mode instruction, so the skill itself needs none.

## Local development

`npm run dev:link` symlinks every skill into `~/.agents/skills/<name>` (with a `~/.claude/skills/<name>` mirror); `npm run dev:unlink` restores the previous state. See the README.

## Checks before a PR

```bash
npm run validate          # skills-reference validate on every skill
```

Trigger-query files stay balanced (8–10 should-trigger, same number should-not) and every output eval asserts skill ids (`solvapay/<surface>`), never `../` paths.
