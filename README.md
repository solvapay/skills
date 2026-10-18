# SolvaPay Skills

[![skills.sh](https://www.skills.sh/badge/solvapay/skills)](https://www.skills.sh/solvapay/skills)

Agent skills for SolvaPay, on both sides of a payment: adding SolvaPay to a project (paid MCP servers, and app integration with hosted checkout, paywalls, usage, webhooks and billing UI), and paying through SolvaPay when an agent meets a SolvaPay paywall.

## Skills

| Skill id | Purpose |
| --- | --- |
| `solvapay` | Router — disambiguates vague intent and points at the right surface skill |
| `solvapay/pay-with-solvapay` | The paying side: what a SolvaPay paywall response means (402, `paywallReason`), the account tools on SolvaPay MCP servers, top-up and auto-recharge, and the buy-side beta for agents that should pay for services themselves |
| `solvapay/create-mcp-app` | Create or scaffold a paid MCP server on Cloudflare Workers (from OpenAPI or hand-written) |
| `solvapay/app-integration` | Hosted checkout and customer portal, paywalls, usage, webhooks, and billing UI for an existing TypeScript / JavaScript app, API or website (Next.js, React, Express, Supabase Edge, Vite + Supabase). Formerly `sdk-integration`; also absorbs the retired `website-checkout` and `lovable-checkout` skills — `--skill website-checkout` and `--skill lovable-checkout` no longer resolve; install `--skill app-integration`. |

## What can it do?

- "Scaffold a paid MCP server from this OpenAPI spec" → `solvapay/create-mcp-app`
- "Add SolvaPay paywall to my Express API" → `solvapay/app-integration`
- "Add usage metering to my MCP server" → `solvapay/create-mcp-app`
- "Add hosted checkout to my Next.js site" → `solvapay/app-integration`
- "Add checkout to my Vite + Supabase (Lovable) app" → `solvapay/app-integration`
- "This API returned 402 with a checkoutUrl" / "let my agent pay for APIs" → `solvapay/pay-with-solvapay`
- "I just want to add SolvaPay" (vague) → `solvapay` asks one disambiguation question, then routes

## Installation

Pick the variant that matches the context.

| Context | Command | Notes |
| --- | --- | --- |
| **Top-of-funnel** (README hero, marketing) | `npx skills add solvapay/skills` | Opens a multi-select prompt across all 4 skills. Best for human discovery. |
| **Quickstart / "install everything"** | `npx skills add solvapay/skills --all -y` | Installs all 4 to every detected agent, no prompts. Optional convenience. |
| **Surface-specific** (e.g. a docs page for one product) | `npx skills add solvapay/skills --skill create-mcp-app -y` | Install just one skill. Routing id is `solvapay/<surface>`; CLI `--skill` uses the flat folder name. |
| **Power user / CI** | `npx skills add solvapay/skills --all -g -y` | Non-interactive global install. |

> Vague intent? Install `solvapay` alone — it routes by **routing id** (`solvapay/<surface>`) and tells the agent to run `npx skills add solvapay/skills --skill <surface> -y` when needed (flat CLI name, e.g. `create-mcp-app`).

## Documentation source priority

Every skill in this family uses the same retrieval chain:

1. SolvaPay Docs MCP server: https://docs.solvapay.com/mcp
2. Fallback docs index: https://docs.solvapay.com/llms.txt
3. Direct docs.solvapay.com page fetch

If MCP is unavailable, the skill continues with fallbacks. MCP setup is a recommended optional improvement.

## Evals

Regression specs for description triggering and output quality live at [`evals/`](evals/) (not loaded when a skill activates). See [`evals/README.md`](evals/README.md) for the harness contract, routing boundaries, and `SKILLS_REPO` / `EVAL_DEV_MODE` env vars.

Per skill: `trigger-queries.json` (8–10 should-trigger + 8–10 should-not, train/validation split) and `evals.json` (output cases with `assertions`).

## Local development and testing

Maintainer notes (versioning, dev backend, what must stay out of a skill) are in [CONTRIBUTING.md](CONTRIBUTING.md).

For live editing, symlink every skill in this repo into the agent skill search
paths (`~/.agents/skills/<name>` plus a `~/.claude/skills/<name>` mirror) so
edits are picked up without reinstalling:

```bash
npm run dev:link     # local development ON  — symlink all skills to this repo
npm run dev:status   # show what is linked where
npm run dev:unlink   # local development OFF — remove symlinks, restore any backups
```

`dev:link` moves any pre-existing standalone copy aside to `<name>.local-backup`
and restores it on `dev:unlink`, so toggling is non-destructive. Run `dev:link`
again after `git pull` only if new skills were added.

Then validate each skill with prompt checks:

1. Edit skill files in this repository (changes are live via the symlinks above).
2. Run 2–3 prompt checks per skill: routing intent, happy-path implementation, failure-path / troubleshooting.
3. Verify outputs follow each skill's guardrails and the shared docs source priority.

Alternatively, install a snapshot with `npx skills add . --skill <name>` (or `--all -y` to mount everything) — but that copies files rather than linking, so edits require a reinstall.

To list all discoverable skills before pushing:

```bash
npx skills add . --list
```

To validate every skill against the [agentskills.io spec](https://agentskills.io/specification):

```bash
npm run validate
```

This runs `npx skills-reference validate` on every directory under `skills/` that contains a `SKILL.md` (router + two flat surface skills).

## Releases and the discovery index

Pushing a `vX.Y.Z` tag runs [`.github/workflows/release-skills.yml`](.github/workflows/release-skills.yml). It builds one release asset per skill, writes an [Agent Skills discovery index](https://schemas.agentskills.io/discovery/0.2.0/schema.json) (`index.json`) with each skill's frontmatter `description` and the SHA-256 of its asset, and attaches everything to the release. The release is created as a draft, the uploaded assets are downloaded and re-verified, and only then published.

The index type is picked per skill, following the spec's distribution guidance:

| Skill folder holds | Index `type` | Release asset |
| --- | --- | --- |
| only `SKILL.md` (e.g. `solvapay`) | `skill-md` | `<name>.md`, the raw `SKILL.md` bytes |
| anything else (`references/`, `scripts/`, …) | `archive` | `<name>.tar.gz`, folder contents at the archive root |

Adding a first reference file to a single-file skill switches it to `archive` on the next release; there is nothing to configure. Symlinks fail the build, because the `skills` CLI rejects links in archives. Archives are deterministic: a skill that hasn't changed keeps the same digest across releases.

Build and verify locally without releasing:

```bash
npm run release:dry-run
```

Output goes to `dist/release/`. The latest index is always at `https://github.com/solvapay/skills/releases/latest/download/index.json`.

## Skill quality expectations

A skill is considered complete when:

- it has clear when-to-use scope and "Use when" trigger keywords in its frontmatter
- it has guardrails with explicit "Never" / "Always" rules
- it has a step-by-step implementation flow
- it has verification and troubleshooting guidance
- it uses docs-only, topic-based references resilient to docs URL changes

## Architecture

```
skills/
├── solvapay/                       # Router (routing id: solvapay)
│   └── SKILL.md
├── pay-with-solvapay/              # routing id: solvapay/pay-with-solvapay (single SKILL.md)
│   └── SKILL.md
├── create-mcp-app/                 # routing id: solvapay/create-mcp-app
│   ├── SKILL.md
│   ├── scripts/
│   └── references/
└── app-integration/                # routing id: solvapay/app-integration
    ├── SKILL.md
    ├── scripts/
    └── references/                 # incl. hosted-checkout-nextjs.md, hosted-checkout-react.md
```

Routing ids use the `solvapay/<surface>` namespace for handoffs. Each directory's `name` frontmatter matches the folder (e.g. `create-mcp-app`); `npx skills add --skill` uses that flat name.
