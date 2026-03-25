# SolvaPay Skills

Agent skill for integrating SolvaPay SDK, onboarding providers, and adding hosted checkout.

## Skill

| Skill | Purpose |
| --- | --- |
| [solvapay](skills/solvapay/) | Routes by intent to SDK integration, website checkout, or provider onboarding |

## What Can It Do?

- "Protect my Express API with paywall checks" -> SDK integration (Express path)
- "Add hosted checkout to my Next.js site" -> website checkout (Next.js path)
- "Set up my provider account, first product, and go live" -> provider onboarding
- "Add usage metering to my MCP server" -> SDK integration (MCP server path)
- "Not sure where to start" -> disambiguation and routing

## Documentation Source Priority

The skill uses this retrieval chain:

1. SolvaPay Docs MCP server: https://docs.solvapay.com/mcp
2. Fallback docs index: https://docs.solvapay.com/llms.txt
3. Direct docs.solvapay.com page fetch

If MCP is unavailable, the skill continues with fallbacks. MCP setup is a recommended optional improvement.

## Installation

```bash
npx skills add https://github.com/solvapay/solvapay-skills --skill solvapay
```

## Local Development and Testing Workflow

1. Edit skill files in this repository.
2. Install/update locally with `npx skills add <repo-or-path> --skill solvapay`.
3. Run 2-3 prompt checks:
   - routing intent prompt
   - happy-path implementation prompt
   - failure-path/troubleshooting prompt
4. Verify outputs follow skill guardrails and docs source priority.

## Skill Quality Expectations

A skill is considered complete when:

- it has clear when-to-use scope
- it has guardrails with explicit "Never" and "Always" rules
- it has step-by-step implementation flow
- it has verification and troubleshooting guidance
- it uses docs-only, topic-based references resilient to docs URL changes

## Architecture

```
solvapay/
├── SKILL.md                     # Router and shared context
├── AGENTS.md -> SKILL.md        # Claude Code compatibility
├── metadata.json                # skills.sh leaderboard metadata
├── sdk-integration/             # SDK paywall, checkout, usage, webhooks
│   ├── guide.md                 # Entry point with stack detection
│   ├── reference.md             # Package map and API operations
│   ├── webhooks.md              # Signature verification and events
│   └── {nextjs,react,express,mcp-server}/guide.md
├── website-checkout/            # Hosted checkout for web apps
│   ├── guide.md                 # Entry point with stack support
│   ├── nextjs/{guide,01-setup,02-auth,03-checkout}.md
│   └── react/guide.md
└── provider-onboarding/         # Account onboarding through go-live
    ├── guide.md                 # Entry point with step overview
    └── {01-create-account,02-create-product-and-plan,03-test-in-sandbox,04-go-live}.md
```
