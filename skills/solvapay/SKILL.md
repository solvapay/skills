---
name: solvapay
description: >
  Use this skill when a user is choosing between SolvaPay surfaces rather than implementing one.
  Load for: any query that pits two options against each other ("checkout or SDK?", "MCP vs
  checkout?", "which one for my app?"), capability questions about SolvaPay, vague billing or
  monetization intent with no specific surface chosen, or assigned SolvaPay work without clear
  direction. Skip when the user has settled on exactly one surface and is asking to build it —
  single-surface intent plus implementation context (tech stack, command, or action verb) routes
  to that surface's dedicated skill instead.
metadata:
  version: "1.0.0"
---

# SolvaPay — Router

Disambiguate vague SolvaPay intent and route to the surface skill that owns the work.

**This skill's only job is routing.** Once you've identified the correct surface and emitted the [handoff template](#handoff-template) or the [Managed MCP exit](#managed-mcp-exit), your turn is over — stop there. Do not read the target skill's SKILL.md. Do not implement any code, steps, or instructions. The user or the target skill will handle implementation. Outputting implementation details after the handoff (even as "helpful context") defeats the purpose of this router and duplicates work the surface skill is designed to do better.

## What SolvaPay does

SolvaPay adds usage-based billing, paywalls, and hosted checkout to apps and AI tools. Answer a "what can SolvaPay do / which one do I need" question with this comparison, then route to the owning surface skill or Managed MCP exit:

| Surface | What you build | Pick when | Route to |
| --- | --- | --- | --- |
| Paid MCP | Per-call or subscription billing on a Cloudflare Workers MCP server | The product **is** MCP tools for AI agents and you want to **write code** (greenfield, OpenAPI→MCP, or paywalling an existing MCP server) | `solvapay/create-mcp-app` |
| Managed MCP | SolvaPay-managed auth, paywall, and proxying for an MCP server you host | You want to monetize an MCP server **without code** — paste your server URL, configure plans in the console | [Managed MCP exit](#managed-mcp-exit) |
| SDK paywall | Gate endpoints, meter usage, handle webhooks in your own code | You own an app/API backend and want billing **in code** (REST, Next.js, Express, any stack) | `solvapay/sdk-integration` |
| Hosted checkout | Drop-in payment page + customer portal | You want a production website to sell access with **no custom billing code** | `solvapay/website-checkout` |
| Lovable checkout | Paste-in Vite + Supabase edge checkout | You're prototyping in a **Lovable / Vite preview** and want checkout pasted in | `solvapay/lovable-checkout` |

## Decision tree

Walk these in order; the first "yes" wins:

1. Is the thing being monetized an **MCP server / MCP tools for AI agents**?
   - **No code / console / paste server URL** → [Managed MCP exit](#managed-mcp-exit).
   - **Write code** (greenfield worker, OpenAPI→MCP, SDK paywall on existing MCP) → `solvapay/create-mcp-app`.
2. Otherwise, is there an **existing app or API backend** to bill from code (paywall, metering, webhooks)? → `solvapay/sdk-integration`.
3. Otherwise, do they just want a **hosted payment page** for a production website (no billing code)? → `solvapay/website-checkout`.
4. Is it specifically a **Lovable / Vite preview** app? → `solvapay/lovable-checkout`.
5. None clearly fits → ask the [disambiguation question](#disambiguation-prompt).

## Guardrails

- Never expose `SOLVAPAY_SECRET_KEY` to client code or public env vars.
- Never build custom card collection if hosted checkout satisfies requirements.
- Always prefer official SolvaPay SDK helpers over ad-hoc raw HTTP calls.
- Always prefer topic-based docs discovery (MCP or `llms.txt`), not hard-coded doc paths.

## Gotchas

- Valid as a standalone install — routes by **skill id** (`solvapay/<surface>`), not filesystem paths.
- "Paywall my API" or "paywall web app" without MCP context → `solvapay/sdk-integration`, not `solvapay/create-mcp-app`.
- "Scaffold mcp" / greenfield MCP worker → `solvapay/create-mcp-app`, not `solvapay/sdk-integration`.
- **Managed MCP** is console-driven — no skill owns it; use the [Managed MCP exit](#managed-mcp-exit), not a fake skill id.
- "Monetize mcp server no-code" / "paste my server url" / "gate tools without code" → Managed MCP exit, not `solvapay/create-mcp-app`.
- Surface skill descriptions own specific keywords; this router owns ambiguous top-of-funnel prompts only.
- "Customer portal" or billing UI inside an MCP host app → `solvapay/sdk-integration`, not `solvapay/website-checkout`.

## Routing procedure

1. Walk the [decision tree](#decision-tree) to get a routing id or Managed MCP exit (or hit step 5 → disambiguation).
2. Cross-check against the [intent matrix](#intent-matrix) phrase-lookup; if the user's wording matches a different row, prefer the matrix and reconcile.
3. If still ambiguous → ask one [disambiguation question](#disambiguation-prompt).
4. Run the [verification loop](#verification-loop).
5. Emit the [handoff template](#handoff-template) or [Managed MCP exit](#managed-mcp-exit) and stop.

Docs discovery (shared by all surface skills): SolvaPay Docs MCP → https://docs.solvapay.com/llms.txt → direct page fetch.

## Intent matrix

Ambiguous / top-of-funnel triggers only. Stack-specific keywords belong on surface skill descriptions.

| User intent | Trigger examples | Route to |
| --- | --- | --- |
| Vague onboarding | "add solvapay", "where do I start", "what can solvapay do", "monetize something" | Ask disambiguation, then route |
| Greenfield paid MCP | "create mcp app", "scaffold mcp", "new mcp server", "openapi to mcp", "npm create solvapay", "paid mcp", "monetize mcp" | `solvapay/create-mcp-app` |
| Existing MCP + audit | "add solvapay to my mcp", "paywall my mcp tools" (needs worker template) | `solvapay/create-mcp-app` |
| Managed MCP (no code) | "no code", "managed mcp", "paste my mcp server url", "gate tools without code", "hosted no-code proxy" | [Managed MCP exit](#managed-mcp-exit) |
| Existing app / API paywall | "integrate sdk", "protect api", "paywall", "usage events", "webhooks", "npx solvapay init" | `solvapay/sdk-integration` |
| Web hosted checkout | "add checkout to website", "hosted checkout", "sell access on my site" | `solvapay/website-checkout` |
| Lovable preview checkout | "lovable", "paste into lovable", "vite checkout", "supabase edge checkout", "@preview" | `solvapay/lovable-checkout` |

## Negative routing examples

- "Migrate old billing data", "general Stripe setup only" → ask clarification; do not auto-route.
- Greenfield MCP from OpenAPI/scratch → `solvapay/create-mcp-app`, NOT `solvapay/sdk-integration`.
- Paywall web/API without MCP → `solvapay/sdk-integration`, NOT `solvapay/create-mcp-app`.
- No-code MCP / paste server URL → Managed MCP exit, NOT `solvapay/create-mcp-app`.

## Disambiguation prompt

"Do you want to (1) build a paid MCP server in code (OpenAPI or hand-written tools), (2) set up Managed MCP in the console (no code — paste your server URL), (3) integrate the TypeScript SDK into an existing app, (4) set up hosted checkout for a production web app, or (5) paste checkout into a Lovable preview app?"

Default if still ambiguous: greenfield MCP in code → `solvapay/create-mcp-app`; no-code MCP → Managed MCP exit; otherwise → `solvapay/sdk-integration`.

## Surface skills

| Skill id | Owns |
| --- | --- |
| `solvapay/create-mcp-app` | Greenfield paid MCP on Cloudflare Workers |
| `solvapay/sdk-integration` | SDK paywall, checkout, usage, webhooks in existing apps |
| `solvapay/website-checkout` | Hosted checkout + portal for production web apps |
| `solvapay/lovable-checkout` | Paste-in preview checkout for Lovable |

Install if missing: `npx skills add solvapay/skills --skill <flat-name> -y` (e.g. `create-mcp-app` for `solvapay/create-mcp-app`).

Managed MCP has no skill — use the [Managed MCP exit](#managed-mcp-exit) instead.

## Verification loop

1. Confirm routing id matches one intent-matrix row, or the prompt is Managed MCP (console exit).
2. Confirm the prompt is not a near-miss negative (see [evals/README.md](../../evals/README.md) boundary table).
3. If mismatch → re-route or ask one clarifying question; do not hand off until pass.

## Handoff template

```markdown
## Routing handoff
- **Routing id:** solvapay/<surface>
- **Why:** [one sentence tied to user intent]
- **Install if missing:** `npx skills add solvapay/skills --skill <flat-name> -y`
- **Next:** Load solvapay/<surface> SKILL.md and follow its instructions.
```

**After emitting this template, stop. Do not add implementation steps, code snippets, or instructions from the target skill. The handoff is the complete output of this skill.**

## Managed MCP exit

Use when the user wants no-code MCP monetization — paste a server URL, gate tools via the console, configure plans without writing paywall code. Managed MCP has no owning skill; this exit replaces the handoff template.

```markdown
## Managed MCP routing
- **Surface:** Managed MCP (console — no code)
- **Why:** [one sentence tied to user intent — e.g. paste server URL, gate tools without code]
- **Next steps:**
  1. Open the SolvaPay provider console and create a Managed MCP product.
  2. Follow docs: `/no-code-mcp/overview` and `/no-code-mcp/quick-start`.
  3. For API bootstrap on an existing Managed MCP product, see `solvapay/sdk-integration` → `references/mcp-product-console.md`.
```

**After emitting this exit, stop. Do not scaffold a worker, write paywall code, or hand off to `solvapay/create-mcp-app`.**

## Task progress

- [ ] Extract primary intent (MCP code / Managed MCP / SDK / web checkout / Lovable / ambiguous)
- [ ] If ambiguous → ask disambiguation question (include Managed MCP and Lovable options)
- [ ] Match routing id from intent matrix, or Managed MCP exit
- [ ] Run verification loop (confirm not a near-miss negative)
- [ ] Install target skill if missing (skill surfaces only)
- [ ] Emit handoff template or Managed MCP exit and stop — do not add code or implementation steps after

## Dev mode (skill author / internal testing only)

If the user explicitly tests against the SolvaPay dev backend, append `--dev` to CLI invocations (`npm create solvapay@latest`, `npx solvapay@latest init`). Never enable for end users.
