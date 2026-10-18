---
name: solvapay
description: >
  SolvaPay is the payment layer for selling APIs, MCP servers and AI agents to agents and their
  users: paywalls, plans, credits, usage billing and checkout. Start here when a task involves
  SolvaPay and the right skill is not clear. Load for: choosing between SolvaPay surfaces
  ("checkout or SDK?", "MCP vs checkout?", "which one for my app?"), capability questions about
  SolvaPay, vague billing or monetization intent, or assigned SolvaPay work without clear
  direction. If you are on the paying side (a call was refused by a SolvaPay paywall, or your user
  wants to pay for, keep funding or let you pay for a service that uses SolvaPay), route to
  solvapay/pay-with-solvapay. Skip when the user has settled on exactly one build surface and is
  asking to build it — single-surface intent plus implementation context (tech stack, command, or
  action verb) routes to that surface's dedicated skill instead.
metadata:
  version: "1.2.0"
---

# SolvaPay — Router

Disambiguate vague SolvaPay intent and route to the surface skill that owns the work.

**This skill's only job is routing.** Once you've identified the correct surface and emitted the [handoff template](#handoff-template) or the [Managed MCP exit](#managed-mcp-exit), your turn is over — stop there. Do not read the target skill's SKILL.md. Do not implement any code, steps, or instructions. The user or the target skill will handle implementation. Outputting implementation details after the handoff (even as "helpful context") defeats the purpose of this router and duplicates work the surface skill is designed to do better.

## What SolvaPay does

SolvaPay adds usage-based billing, paywalls, and hosted checkout to apps and AI tools, so their owners get paid by people and agents. Agents and their users meet it from the other side when a SolvaPay paywall asks them to pay. Answer a "what can SolvaPay do / which one do I need" question with this comparison, then route to the owning surface skill or Managed MCP exit:

| Surface | What you build | Pick when | Route to |
| --- | --- | --- | --- |
| Paid MCP | Per-call or subscription billing on a Cloudflare Workers MCP server | The product **is** MCP tools for AI agents and you want to **write code** (greenfield, OpenAPI→MCP, or paywalling an existing MCP server) | `solvapay/create-mcp-app` |
| Managed MCP | SolvaPay-managed auth, paywall, and proxying for an MCP server you host | You want to monetize an MCP server **without code** — paste your server URL, configure plans in the console | [Managed MCP exit](#managed-mcp-exit) |
| App integration | Hosted checkout + customer portal, gated endpoints, usage metering, webhooks, and billing UI in your own code | You own an app, API or website (Next.js, React, Express, Supabase Edge, Vite + Supabase) and want SolvaPay wired into it — from a plain "subscribe → redirect to checkout" flow up to a full SDK integration | `solvapay/app-integration` |
| Pay with SolvaPay | Nothing — you are the customer: get past a SolvaPay paywall, top up, upgrade, or request buy-side early access so an agent can pay | A call to someone else's API or MCP tool was refused by SolvaPay, or the user wants to pay for or keep funding a service that uses SolvaPay, or wants their agent to be able to pay | `solvapay/pay-with-solvapay` |

## Decision tree

Walk these in order; the first "yes" wins:

0. Is the user or agent on the **paying side** — refused by a SolvaPay paywall (HTTP 402, `checkoutUrl`, `paywallReason`), asking how to pay for, upgrade or top up a service that uses SolvaPay, or wanting an agent that can pay? → `solvapay/pay-with-solvapay`.
1. Is the thing being monetized an **MCP server / MCP tools for AI agents**?
   - **No code / console / paste server URL** → [Managed MCP exit](#managed-mcp-exit).
   - **Write code** (greenfield worker, OpenAPI→MCP, paywall or factory wrap on an existing MCP) → `solvapay/create-mcp-app`.
2. Otherwise, is there an **existing app, API or website** to add SolvaPay to — hosted checkout and customer portal, a paywall, metering, webhooks or billing UI? → `solvapay/app-integration`.
3. None clearly fits → ask the [disambiguation question](#disambiguation-prompt).

## Guardrails

- Never expose `SOLVAPAY_SECRET_KEY` to client code or public env vars.
- Never build custom card collection if hosted checkout satisfies requirements.
- Always prefer official SolvaPay SDK helpers over ad-hoc raw HTTP calls.
- Always prefer topic-based docs discovery (the Docs MCP or `llms.txt`), not hard-coded doc paths.

## Gotchas

- Valid as a standalone install — routes by **skill id** (`solvapay/<surface>`), not filesystem paths.
- "Paywall my API" or "paywall web app" without MCP context → `solvapay/app-integration`, not `solvapay/create-mcp-app`.
- "Scaffold mcp" / greenfield MCP worker → `solvapay/create-mcp-app`, not `solvapay/app-integration`.
- **Managed MCP** is console-driven — no skill owns it; use the [Managed MCP exit](#managed-mcp-exit), not a fake skill id.
- "Monetize mcp server no-code" / "paste my server url" / "gate tools without code" → Managed MCP exit, not `solvapay/create-mcp-app`.
- Surface skill descriptions own specific keywords; this router owns ambiguous top-of-funnel prompts only.
- "Customer portal" or billing UI inside an MCP host app → `solvapay/create-mcp-app` (`references/mcp-apps-ui.md`), not `solvapay/app-integration`.
- "Add checkout to my website" / "subscribe button" / "hosted checkout" → `solvapay/app-integration` (its hosted-checkout path); there is no separate checkout skill.
- A 402 or "access denied — requires … plan" from **someone else's** API or MCP tool, "top up credits", "how do I let my agent pay" → `solvapay/pay-with-solvapay`. Building a paywall that **returns** 402 → `solvapay/app-integration` or `solvapay/create-mcp-app`.

## Routing procedure

1. Walk the [decision tree](#decision-tree) to get a routing id or Managed MCP exit (or hit step 3 → disambiguation).
2. Cross-check against the [intent matrix](#intent-matrix) phrase-lookup; if the user's wording matches a different row, prefer the matrix and reconcile.
3. If still ambiguous → ask one [disambiguation question](#disambiguation-prompt).
4. Run the [verification loop](#verification-loop).
5. Emit the [handoff template](#handoff-template) or [Managed MCP exit](#managed-mcp-exit) and stop.

Docs discovery (shared by all surface skills): SolvaPay Docs MCP (`https://docs.solvapay.com/mcp`, HTTP transport, no auth) → https://docs.solvapay.com/llms.txt → direct page fetch.

## Intent matrix

Ambiguous / top-of-funnel triggers only. Stack-specific keywords belong on surface skill descriptions.

| User intent | Trigger examples | Route to |
| --- | --- | --- |
| Vague onboarding | "add solvapay", "where do I start", "what can solvapay do", "monetize something" | Ask disambiguation, then route |
| Greenfield paid MCP | "create mcp app", "scaffold mcp", "new mcp server", "openapi to mcp", "npm create solvapay", "paid mcp", "monetize mcp" | `solvapay/create-mcp-app` |
| Existing MCP server (add paywall / wrap with factory) | "add solvapay to my mcp", "paywall my mcp tools", "wrap with the factory" | `solvapay/create-mcp-app` |
| Managed MCP (no code) | "no code", "managed mcp", "paste my mcp server url", "gate tools without code", "hosted no-code proxy" | [Managed MCP exit](#managed-mcp-exit) |
| Existing app / API paywall | "integrate sdk", "protect api", "paywall", "usage events", "webhooks", "npx solvapay init" | `solvapay/app-integration` |
| Web hosted checkout | "add checkout to website", "hosted checkout", "sell access on my site", "customer portal", "subscribe button" | `solvapay/app-integration` |
| Vite + Supabase app (incl. Lovable, Bolt) | "lovable", "vite checkout", "supabase edge checkout" | `solvapay/app-integration` (Supabase Edge path) |
| Paying side (customer or agent) | "got a 402 from a solvapay api", "tool says I need a pro plan", "out of credits", "top up", "let my agent pay for apis", "agent spending limits" | `solvapay/pay-with-solvapay` |

## Negative routing examples

- "Migrate old billing data", "general Stripe setup only" → ask clarification; do not auto-route.
- Greenfield MCP from OpenAPI/scratch → `solvapay/create-mcp-app`, NOT `solvapay/app-integration`.
- Paywall web/API without MCP → `solvapay/app-integration`, NOT `solvapay/create-mcp-app`.
- No-code MCP / paste server URL → Managed MCP exit, NOT `solvapay/create-mcp-app`.
- "Make my API return 402 when unpaid" → `solvapay/app-integration`, NOT `solvapay/pay-with-solvapay` (that skill is for the paying side).

## Disambiguation prompt

"Do you want to (1) build a paid MCP server in code (OpenAPI or hand-written tools), (2) set up Managed MCP in the console (no code — paste your server URL), or (3) add SolvaPay to an existing app, API or website — hosted checkout and customer portal, a paywall, usage metering, webhooks or billing UI?"

Default if still ambiguous: greenfield MCP in code → `solvapay/create-mcp-app`; no-code MCP → Managed MCP exit; otherwise → `solvapay/app-integration`.

## Surface skills

| Skill id | Owns |
| --- | --- |
| `solvapay/create-mcp-app` | Paid MCP in code — greenfield worker, OpenAPI→MCP, or paywalling an existing MCP server |
| `solvapay/app-integration` | Hosted checkout + customer portal, paywalls, usage, webhooks, and billing UI in an existing app, API or website |
| `solvapay/pay-with-solvapay` | The paying side: SolvaPay paywall responses, account tools, top-up and buy-side early access |

Install if missing: `npx skills add solvapay/skills --skill <flat-name> -y` (e.g. `create-mcp-app` for `solvapay/create-mcp-app`).

Managed MCP has no skill — use the [Managed MCP exit](#managed-mcp-exit) instead.

## Verification loop

1. Confirm routing id matches one intent-matrix row, or the prompt is Managed MCP (console exit). Paying-side prompts go to `solvapay/pay-with-solvapay` before any build surface is considered.
2. Confirm the prompt is not a near-miss negative: a sibling skill's keywords with no MCP server, no code, or no existing app behind them (see [Negative routing examples](#negative-routing-examples) and [Gotchas](#gotchas)).
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
  3. For API bootstrap on an existing Managed MCP product, see `solvapay/app-integration` → `references/mcp-product-console.md`.
```

**After emitting this exit, stop. Do not scaffold a worker, write paywall code, or hand off to `solvapay/create-mcp-app`.**

## Task progress

- [ ] Extract primary intent (paying side / MCP code / Managed MCP / app integration incl. hosted checkout / ambiguous)
- [ ] If ambiguous → ask disambiguation question (include the Managed MCP option)
- [ ] Match routing id from intent matrix, or Managed MCP exit
- [ ] Run verification loop (confirm not a near-miss negative)
- [ ] Install target skill if missing (skill surfaces only)
- [ ] Emit handoff template or Managed MCP exit and stop — do not add code or implementation steps after

