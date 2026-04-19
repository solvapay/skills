---
name: solvapay
description: >
  Integrate SolvaPay into any project -- TypeScript SDK integration for Next.js, React,
  Express, and MCP Server implementations, including CLI-guided setup with
  `npx solvapay init`; MCP Pay no-code hosted MCP monetization;
  provider account onboarding; and hosted web checkout flows. Use this
  skill whenever the user mentions SolvaPay, payments, billing, monetization, pricing,
  paywalls, checkout, purchases, products, plans, customer portal, usage tracking,
  webhooks, or any payment-related setup, even if they don't explicitly say 'SolvaPay'.
---

# SolvaPay

Route user intent to the right domain guide and provide shared context.

## Quick Start

1. Identify the primary user intent from request keywords.
2. If intent is ambiguous, ask one disambiguation question.
3. Read the matching domain guide:
   - [sdk-integration/guide.md](sdk-integration/guide.md) -- TypeScript SDK paywall, checkout, usage, webhooks
   - [mcp-pay/guide.md](mcp-pay/guide.md) -- no-code hosted MCP monetization with bootstrap and plan configuration
   - [website-checkout/guide.md](website-checkout/guide.md) -- hosted checkout and customer portal for web apps
   - [provider-onboarding/guide.md](provider-onboarding/guide.md) -- SolvaPay Console onboarding: account + onboarding form, first product with plans, then Stripe and go-live
4. Follow the domain guide to completion.

## Documentation Sources

Use this preference order for all domains:

1. SolvaPay Docs MCP server (preferred): https://docs.solvapay.com/mcp
2. Docs index fallback: https://docs.solvapay.com/llms.txt
3. Direct docs page fetch on docs.solvapay.com

If the MCP server is unavailable, suggest it as a friendly optional improvement. Continue without blocking.

## Guardrails

- Never expose `SOLVAPAY_SECRET_KEY` to client code or public env vars.
- Never build custom card collection if hosted checkout or MCP Pay satisfies requirements.
- Always prefer official SolvaPay SDK helpers over ad-hoc raw HTTP calls.
- Always prefer topic-based docs discovery (MCP or `llms.txt`), not hard-coded doc paths.

## Intent Matrix

| User intent | Trigger examples | Route to |
| --- | --- | --- |
| SDK integration | "integrate sdk", "protect api", "paywall", "usage events", "webhooks", "express", "MCP Server code integration", "nextjs sdk", "npx solvapay init", "cli", "init project", "scaffold", "cancel renewal", "reactivate", "activate plan", "switch plan", "supabase edge functions", "deno", "edge runtime backend", "lovable backend" | [sdk-integration/guide.md](sdk-integration/guide.md) |
| MCP Pay setup | "bootstrap mcp", "hosted mcp", "mcp pay", "monetize mcp server no-code", "mcp product bootstrap" | [mcp-pay/guide.md](mcp-pay/guide.md) |
| Web app checkout | "add checkout to website", "hosted checkout", "customer portal", "nextjs checkout" | [website-checkout/guide.md](website-checkout/guide.md) |
| Provider onboarding | "create account", "create product", "create plan", "sandbox test", "go live", "provider setup" | [provider-onboarding/guide.md](provider-onboarding/guide.md) |

## Negative Routing Examples

- "Migrate old billing data", "analytics reporting", "general Stripe setup only" -> do not auto-route; ask clarification.
- "Build MCP app UI" without SDK/paywall details -> clarify before routing.
- "Fix one broken endpoint" with no product context -> ask whether this is SDK integration or onboarding issue.

## Disambiguation Prompt

Use this if needed:

"Do you want to (1) integrate the TypeScript SDK in code, (2) set up MCP Pay hosted monetization for an MCP server, (3) set up hosted checkout for a web app, or (4) configure your provider account and product in SolvaPay Console?"

Default if still ambiguous after one question:
- If request is no-code and MCP-focused, route to `mcp-pay/guide.md`.
- If request is no-code onboarding/admin flow, route to `provider-onboarding/guide.md`.
- Otherwise, route to `sdk-integration/guide.md`.

## Task Progress

- [ ] Identify primary intent
- [ ] Route to the correct domain guide
- [ ] If needed, ask one disambiguation question
- [ ] Complete the domain guide to handoff
