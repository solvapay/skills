---
name: solvapay
description: Route Solvapay requests to the correct specialist skill for SDK integration, provider onboarding, or website checkout. Use when the user asks to integrate Solvapay, set up products/plans, onboard providers, or add checkout.
---

# Solvapay Router

Route user intent to one specialist skill. Keep this file focused on classification and handoff only.

## Quick Start

1. Identify the primary user intent from request keywords.
2. If intent is ambiguous, ask one disambiguation question.
3. Route to exactly one skill:
   - `integrate-solvapay-sdk`
   - `onboard-solvapay-provider`
   - `integrate-website-checkout`
4. Pass relevant context to the target skill and stop routing.

## Documentation Sources

Use this retrieval order:

1. SolvaPay Docs MCP server (preferred): https://docs.solvapay.com/mcp
2. Docs index fallback: https://docs.solvapay.com/llms.txt
3. Direct docs page fetch on docs.solvapay.com

If the MCP server is unavailable, suggest it as a friendly optional improvement. Continue without blocking.

## Guardrails

- Never implement code or long technical walkthroughs in this skill.
- Never route to more than one specialist skill unless the user explicitly asks for combined work.
- Always ask exactly one disambiguation question if intent is unclear.
- Always prefer topic-based docs discovery (MCP or `llms.txt`), not hard-coded doc paths.

## Intent Matrix

| User intent | Trigger examples | Route to |
| --- | --- | --- |
| SDK integration | "integrate sdk", "protect api", "paywall", "usage events", "webhooks", "express", "mcp server", "nextjs sdk" | `integrate-solvapay-sdk` |
| Provider onboarding | "create account", "create product", "create plan", "sandbox test", "go live", "provider setup" | `onboard-solvapay-provider` |
| Website hosted checkout | "add checkout to website", "hosted checkout", "customer portal", "nextjs checkout" | `integrate-website-checkout` |

## Negative Routing Examples

- "Migrate old billing data", "analytics dashboard", "general Stripe setup only" -> do not auto-route; ask clarification.
- "Build MCP app UI" without SDK/paywall details -> clarify before routing.
- "Fix one broken endpoint" with no product context -> ask whether this is SDK integration or onboarding issue.

## Routing Rules

- **SDK integration intent** -> route to `integrate-solvapay-sdk`
- **Provider onboarding intent** -> route to `onboard-solvapay-provider`
- **Website checkout intent** -> route to `integrate-website-checkout`

## Disambiguation Prompt

Use this if needed:

"Do you want to (1) integrate the SDK in code, (2) onboard your provider setup, or (3) add website checkout?"

Default if still ambiguous after one question: route to `integrate-solvapay-sdk`.

## Handoff Protocol

When routing, pass this context to the target skill:

- user goal in one sentence
- detected stack (if known)
- constraints (framework, auth system, hosted vs embedded preference)
- docs status (MCP available or fallback used)
- any already-chosen refs (product/plan/customer identifiers if provided)

## Do Not Implement Here

- do not generate route handlers
- do not generate onboarding checklists beyond routing
- do not duplicate operation reference content from specialist skills

## Task Progress

- [ ] Identify primary intent
- [ ] Route to exactly one specialist skill
- [ ] If needed, ask one disambiguation question
- [ ] Pass handoff context to routed skill
- [ ] Confirm docs source chain was applied
