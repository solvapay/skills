---
name: solvapay
description: >
  Integrate SolvaPay into any project -- TypeScript SDK integration for Next.js, React,
  Express, and MCP Server implementations, including CLI-guided setup with
  `npx solvapay init`; create a paid MCP app (from OpenAPI spec or hand-written) on
  Cloudflare Workers and other edge runtimes; hosted web checkout flows; and a paste-in Lovable
  (Vite + shadcn/ui + Supabase Edge) checkout guide. Use this skill whenever the user
  mentions SolvaPay, payments, billing, monetization, pricing, paywalls, paid mcp,
  paywall mcp, checkout, purchases, products, plans, customer portal,
  usage tracking, webhooks, Lovable, MCP server, MCP app, or any payment-related setup,
  even if they don't explicitly say 'SolvaPay'.
---

# SolvaPay

Route user intent to the right domain guide and provide shared context.

## Quick Start

1. Identify the primary user intent from request keywords.
2. If intent is ambiguous, ask one disambiguation question.
3. Read the matching domain guide:
   - [create-mcp-app/guide.md](create-mcp-app/guide.md) -- create or scaffold a paid MCP app (from OpenAPI spec or hand-written tools), Cloudflare Workers default with full inline templates
   - [sdk-integration/guide.md](sdk-integration/guide.md) -- TypeScript SDK paywall, checkout, usage, webhooks
   - [website-checkout/guide.md](website-checkout/guide.md) -- hosted checkout and customer portal for web apps
   - [lovable-checkout/guide.md](lovable-checkout/guide.md) -- preview-only paste-in guide for Lovable apps (Vite + shadcn/ui + Supabase Edge Functions)
4. Follow the domain guide to completion.

## Documentation Sources

Use this preference order for all domains:

1. SolvaPay Docs MCP server (preferred): https://docs.solvapay.com/mcp
2. Docs index fallback: https://docs.solvapay.com/llms.txt
3. Direct docs page fetch on docs.solvapay.com

If the MCP server is unavailable, suggest it as a friendly optional improvement. Continue without blocking.

## Guardrails

- Never expose `SOLVAPAY_SECRET_KEY` to client code or public env vars.
- Never build custom card collection if hosted checkout satisfies requirements.
- Always prefer official SolvaPay SDK helpers over ad-hoc raw HTTP calls.
- Always prefer topic-based docs discovery (MCP or `llms.txt`), not hard-coded doc paths.

## Intent Matrix

| User intent | Trigger examples | Route to |
| --- | --- | --- |
| Create / scaffold a paid MCP app | "create mcp app", "scaffold mcp", "new mcp server", "greenfield mcp", "openapi to mcp", "wrap rest api as mcp", "generate mcp from swagger", "build mcp app", "npm create solvapay", "from scratch mcp worker", "cloudflare workers mcp from scratch", "paid mcp", "monetize mcp", "paywall mcp", "mcp with payments", "mcp billing", "intent-driven mcp", "data mcp server", "intelligence mcp" | [create-mcp-app/guide.md](create-mcp-app/guide.md) |
| Add paywall to an existing MCP server | "add solvapay to my mcp", "integrate into existing mcp", "integrate solvapay into existing mcp", "paywall my mcp tools", "monetize my mcp tools" (no scaffold / greenfield intent) | [create-mcp-app/existing-server/guide.md](create-mcp-app/existing-server/guide.md) or [sdk-integration/mcp-server/guide.md](sdk-integration/mcp-server/guide.md) depending on whether they need the full worker template |
| SDK integration | "integrate sdk", "protect api", "paywall", "usage events", "webhooks", "express", "MCP Server code integration", "nextjs sdk", "npx solvapay init", "cli", "init project", "cancel renewal", "reactivate", "activate plan", "switch plan", "supabase edge functions", "deno", "edge runtime backend", "lovable backend" | [sdk-integration/guide.md](sdk-integration/guide.md) |
| MCP server on edge runtime (existing server) | "createSolvaPayMcpFetch", "fetch-first mcp", "@solvapay/mcp/fetch", "mcp on the edge", "wrangler mcp", "supabase edge mcp", "deno mcp server" — when the user already has a server and wants SDK wiring only | [sdk-integration/mcp-server/guide.md](sdk-integration/mcp-server/guide.md) |
| New MCP server on edge runtime (greenfield) | "cloudflare workers mcp", "new cloudflare workers mcp", "scaffold cloudflare mcp worker" — when they want a new Workers project from scratch | [create-mcp-app/guide.md](create-mcp-app/guide.md) |
| MCP checkout app / embedded MCP UI | "mcp checkout app", "mcp app", "CurrentPlanCard", "LaunchCustomerPortalButton", "usePaymentMethod", "createMcpAppAdapter", "embedded checkout in mcp host", "basic-host checkout", "ChatGPT mcp app" | [sdk-integration/mcp-server/guide.md](sdk-integration/mcp-server/guide.md) (server) + [sdk-integration/react/guide.md](sdk-integration/react/guide.md) (client) |
| Account management UI | "customer portal button", "current plan card", "update card", "cancel plan", "payment method preview", "render mirrored card", "self-serve billing ui" | [sdk-integration/react/guide.md](sdk-integration/react/guide.md) |
| Web app checkout | "add checkout to website", "hosted checkout", "customer portal", "nextjs checkout" | [website-checkout/guide.md](website-checkout/guide.md) |
| Lovable checkout (preview) | "lovable", "vite checkout", "shadcn checkout", "supabase edge checkout", "solvapay in lovable", "paste this into lovable", "@preview" | [lovable-checkout/guide.md](lovable-checkout/guide.md) |

## Negative Routing Examples

- "Migrate old billing data", "analytics reporting", "general Stripe setup only" -> do not auto-route; ask clarification.
- "Monetize mcp server no-code" or "hosted MCP monetization" -> the hosted-proxy product is deprecated. Ask the user to clarify; default to `create-mcp-app/guide.md` per the vocabulary rule.
- "Paywall my API" / "paywall web app" without MCP context -> route to `sdk-integration/`, NOT `create-mcp-app/`. Paywalled MCP and paywalled REST/web are different surfaces.
- "Create a new paid MCP server from OpenAPI / scratch" / "scaffold mcp" without existing-server context -> route to `create-mcp-app/`, NOT `sdk-integration/`.
- "Build MCP app UI" without SDK/paywall details -> clarify before routing.
- "Fix one broken endpoint" with no product context -> ask whether this is SDK integration or onboarding issue.

## Disambiguation Prompt

Use this if needed:

"Do you want to (1) build a paid MCP server (from OpenAPI spec or hand-written tools), (2) integrate the TypeScript SDK into a non-MCP app, or (3) set up hosted checkout for a web app?"

Default if still ambiguous after one question:
- If request is creating/scaffolding a paid MCP worker (greenfield), route to `create-mcp-app/guide.md`.
- If request is MCP-focused and code-based but not clearly greenfield, route to `create-mcp-app/guide.md` (the umbrella asks input-mode follow-up).
- Otherwise, route to `sdk-integration/guide.md`.

## Task Progress

- [ ] Identify primary intent
- [ ] Route to the correct domain guide
- [ ] If needed, ask one disambiguation question
- [ ] Complete the domain guide to handoff
