# SolvaPay Skills

[![skills.sh](https://www.skills.sh/badge/solvapay/skills)](https://www.skills.sh/solvapay/skills)

Agent skills for adding SolvaPay to any project: paid MCP servers, TypeScript SDK integration, hosted checkout, and Lovable paste-in checkout.

## Skills

| Skill | Purpose |
| --- | --- |
| [solvapay](skills/solvapay/) | Router — disambiguates vague intent and points at the right surface skill |
| [create-mcp-app](skills/create-mcp-app/) | Create or scaffold a paid MCP server on Cloudflare Workers (from OpenAPI or hand-written) |
| [sdk-integration](skills/sdk-integration/) | TypeScript SDK paywall, checkout, usage, webhooks for Next.js / React / Express / MCP / Supabase Edge |
| [website-checkout](skills/website-checkout/) | Hosted checkout and customer portal for web apps |
| [lovable-checkout](skills/lovable-checkout/) | Paste-in preview-only checkout for Lovable (Vite + shadcn/ui + Supabase Edge) |

## What can it do?

- "Scaffold a paid MCP server from this OpenAPI spec" → `create-mcp-app`
- "Add SolvaPay paywall to my Express API" → `sdk-integration`
- "Add usage metering to my MCP server" → `sdk-integration`
- "Add hosted checkout to my Next.js site" → `website-checkout`
- "Paste SolvaPay checkout into my Lovable app" → `lovable-checkout`
- "I just want to add SolvaPay" (vague) → `solvapay` asks one disambiguation question, then routes

## Installation

Pick the variant that matches the context.

| Context | Command | Notes |
| --- | --- | --- |
| **Top-of-funnel** (README hero, marketing) | `npx skills add solvapay/skills` | Opens a multi-select prompt across all 5 skills. Best for human discovery. |
| **Quickstart / "install everything"** (recommended default) | `npx skills add solvapay/skills --all -y` | Installs all 5 to every detected agent, no prompts. Safest because the router skill cross-links to its siblings. |
| **Surface-specific** (e.g. a docs page for one product) | `npx skills add solvapay/skills --skill create-mcp-app -y` | Install just one skill. Swap `create-mcp-app` for `sdk-integration`, `website-checkout`, `lovable-checkout`, or `solvapay`. |
| **Power user / CI** | `npx skills add solvapay/skills --all -g -y` | Non-interactive global install. |

> If you install only the router (`--skill solvapay`), its relative links into sibling skills will not resolve. Pair it with `--all -y` or install the surface skill you need directly.

## Documentation source priority

Every skill in this family uses the same retrieval chain:

1. SolvaPay Docs MCP server: https://docs.solvapay.com/mcp
2. Fallback docs index: https://docs.solvapay.com/llms.txt
3. Direct docs.solvapay.com page fetch

If MCP is unavailable, the skill continues with fallbacks. MCP setup is a recommended optional improvement.

## Local development and testing

1. Edit skill files in this repository.
2. Install/update locally with `npx skills add . --skill <name>` (or `--all -y` to mount everything).
3. Run 2–3 prompt checks per skill: routing intent, happy-path implementation, failure-path / troubleshooting.
4. Verify outputs follow each skill's guardrails and the shared docs source priority.

To list all discoverable skills before pushing:

```bash
npx skills add . --list
```

To validate every skill against the [agentskills.io spec](https://agentskills.io/specification):

```bash
npm run validate
```

This runs `npx skills-reference validate` against each skill directory. The validator catches drift in `SKILL.md` frontmatter (name length, description length, missing required fields) and basic structural issues. Note: both `skills-reference` (npm) and `skills-ref` (Python) self-describe as "for demonstration purposes only" — treat as a drift-catcher, not a hard production gate.

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
├── LICENSE                       # MIT
├── package.json                  # validate script (npx skills-reference)
├── .claude-plugin/
│   └── marketplace.json          # Claude Code marketplace manifest (scans the 5 skill roots)
├── .github/workflows/
│   └── validate-skills.yml       # CI: runs skills-reference on PRs touching skills/
├── evals/                        # Eval specs (not loaded into agent context)
│   ├── create-mcp-app/           # evals.json, trigger-queries.json, fixtures/
│   ├── solvapay/
│   ├── sdk-integration/
│   ├── website-checkout/
│   └── lovable-checkout/
└── skills/
    ├── solvapay/                 # Router and shared context
    │   ├── SKILL.md
    │   └── AGENTS.md -> SKILL.md
    ├── create-mcp-app/           # Create or scaffold a paid MCP app on Cloudflare Workers
    │   ├── SKILL.md              # Entry, mandatory read order, first-decision routing, guardrails
    │   ├── AGENTS.md -> SKILL.md
    │   ├── scripts/              # describe.mjs / scaffold.mjs wrappers → create-solvapay
    │   └── references/
    │       ├── tool-design.md
    │       ├── hitl-conventions.md
    │       ├── solvapay-init.md
    │       ├── existing-server.md
    │       ├── from-openapi/     # Generate from an OpenAPI / Swagger spec (agent path)
    │       ├── from-scratch/     # Hand-written tools (greenfield)
    │       └── hosting/cloudflare/  # setup, widget-templates-*, deploy-verify, troubleshooting
    ├── sdk-integration/          # SDK paywall, checkout, usage, webhooks
    │   ├── SKILL.md              # Stack detection, implementation order, guardrails
    │   ├── AGENTS.md -> SKILL.md
    │   └── references/
    │       ├── REFERENCE.md        # Package map, install, env vars, operations
    │       ├── WEBHOOKS.md
    │       └── {nextjs,react,express,mcp-server,supabase-edge}.md
    ├── website-checkout/         # Hosted checkout for web apps
    │   ├── SKILL.md
    │   ├── AGENTS.md -> SKILL.md
    │   └── references/{nextjs,react}.md
    └── lovable-checkout/         # Paste-in checkout for Lovable (preview)
        ├── SKILL.md
        ├── AGENTS.md -> SKILL.md
        └── references/{GUIDE.md, REFERENCE.md}
```
