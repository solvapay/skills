# SolvaPay Skills

[![skills.sh](https://www.skills.sh/badge/solvapay/skills)](https://www.skills.sh/solvapay/skills)

Agent skills for adding SolvaPay to any project: paid MCP servers, TypeScript SDK integration, hosted checkout, and Lovable paste-in checkout.

## Skills

| Skill id | Purpose |
| --- | --- |
| `solvapay` | Router — disambiguates vague intent and points at the right surface skill |
| `solvapay/create-mcp-app` | Create or scaffold a paid MCP server on Cloudflare Workers (from OpenAPI or hand-written) |
| `solvapay/sdk-integration` | TypeScript SDK paywall, checkout, usage, webhooks for Next.js / React / Express / MCP / Supabase Edge |
| `solvapay/website-checkout` | Hosted checkout and customer portal for web apps |
| `solvapay/lovable-checkout` | Paste-in preview-only checkout for Lovable (Vite + shadcn/ui + Supabase Edge) |

## What can it do?

- "Scaffold a paid MCP server from this OpenAPI spec" → `solvapay/create-mcp-app`
- "Add SolvaPay paywall to my Express API" → `solvapay/sdk-integration`
- "Add usage metering to my MCP server" → `solvapay/sdk-integration`
- "Add hosted checkout to my Next.js site" → `solvapay/website-checkout`
- "Paste SolvaPay checkout into my Lovable app" → `solvapay/lovable-checkout`
- "I just want to add SolvaPay" (vague) → `solvapay` asks one disambiguation question, then routes

## Installation

Pick the variant that matches the context.

| Context | Command | Notes |
| --- | --- | --- |
| **Top-of-funnel** (README hero, marketing) | `npx skills add solvapay/skills` | Opens a multi-select prompt across all 5 skills. Best for human discovery. |
| **Quickstart / "install everything"** | `npx skills add solvapay/skills --all -y` | Installs all 5 to every detected agent, no prompts. Optional convenience. |
| **Surface-specific** (e.g. a docs page for one product) | `npx skills add solvapay/skills --skill create-mcp-app -y` | Install just one skill. Routing id is `solvapay/<surface>`; CLI `--skill` uses the flat folder name. |
| **Power user / CI** | `npx skills add solvapay/skills --all -g -y` | Non-interactive global install. |

> Vague intent? Install `solvapay` alone — it routes by **routing id** (`solvapay/<surface>`) and tells the agent to run `npx skills add solvapay/skills --skill <surface> -y` when needed (flat CLI name, e.g. `create-mcp-app`).

## Documentation source priority

Every skill in this family uses the same retrieval chain:

1. SolvaPay Docs MCP server: https://docs.solvapay.com/mcp
2. Fallback docs index: https://docs.solvapay.com/llms.txt
3. Direct docs.solvapay.com page fetch

If MCP is unavailable, the skill continues with fallbacks. MCP setup is a recommended optional improvement.

## Maintainer note: MCP server wiring

`skills/create-mcp-app/references/mcp-server-wiring.md` is a vendored copy of `skills/sdk-integration/references/mcp-server.md`. When you change MCP paywall wiring guidance, update **both** files (or add a sync script later).

## Evals

Regression specs for description triggering and output quality live at [`evals/`](evals/) (not loaded when a skill activates). See [`evals/README.md`](evals/README.md) for the harness contract, routing boundaries, and `SKILLS_REPO` / `EVAL_DEV_MODE` env vars.

Per skill: `trigger-queries.json` (8–10 should-trigger + 8–10 should-not, train/validation split) and `evals.json` (output cases with `assertions`).

## Local development and testing

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

This runs `npx skills-reference validate` on every directory under `skills/` that contains a `SKILL.md` (router + four flat surface skills).

## `AGENTS.md` symlinks

Each skill directory ships an `AGENTS.md -> SKILL.md` symlink. This is a compatibility shim for `AGENTS.md`-aware clients (Claude Code, OpenAI Codex, OpenHands) that look for `AGENTS.md` at the root of a project or skill. The agentskills.io spec only requires `SKILL.md`; the symlink is purely additive so the same directory works in both ecosystems.

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
│   ├── SKILL.md
│   └── AGENTS.md -> SKILL.md
├── create-mcp-app/                 # routing id: solvapay/create-mcp-app
│   ├── SKILL.md
│   ├── scripts/
│   └── references/
├── sdk-integration/                # routing id: solvapay/sdk-integration
├── website-checkout/               # routing id: solvapay/website-checkout
└── lovable-checkout/               # routing id: solvapay/lovable-checkout
```

Routing ids use the `solvapay/<surface>` namespace for handoffs. Each directory's `name` frontmatter matches the folder (e.g. `create-mcp-app`); `npx skills add --skill` uses that flat name.
