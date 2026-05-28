---
name: solvapay
description: >
  Router and disambiguation entry point for the SolvaPay skill family. Use only when the
  user's intent is vague ("add solvapay to my project", "where do I start with solvapay",
  "what can solvapay do") and no specific surface skill has triggered. Owns the shared
  documentation-discovery preference and the cross-skill guardrails; routes the agent to
  exactly one of `create-mcp-app`, `sdk-integration`, `website-checkout`, or
  `lovable-checkout`. For specific intents (paywall, checkout, paid MCP, Lovable, SDK,
  webhooks, usage metering), the surface skills should auto-trigger -- use them directly.
---

# SolvaPay — Router

Disambiguate vague SolvaPay intent and route to the surface skill that owns the work. This skill exists to catch top-level prompts ("add solvapay to my app") and to host the shared docs-discovery preference and cross-skill guardrails so the surface skills don't duplicate them.

## Quick Start

1. Identify the primary user intent from request keywords.
2. If intent is ambiguous, ask one disambiguation question (see prompt below).
3. Route to the matching surface skill:
   - [../create-mcp-app/SKILL.md](../create-mcp-app/SKILL.md) — create or scaffold a paid MCP app on Cloudflare Workers (OpenAPI or hand-written)
   - [../sdk-integration/SKILL.md](../sdk-integration/SKILL.md) — TypeScript SDK paywall, checkout, usage, webhooks in existing apps
   - [../website-checkout/SKILL.md](../website-checkout/SKILL.md) — hosted checkout and customer portal for web apps
   - [../lovable-checkout/SKILL.md](../lovable-checkout/SKILL.md) — paste-in preview-only guide for Lovable (Vite + shadcn/ui + Supabase Edge)
4. Follow the surface skill's `SKILL.md` to completion.

> Installed only this router? The `../<sibling>/...` links will not resolve. Install all five skills together with `npx skills add solvapay/skills --all -y` (recommended) or pull just the one you need with `--skill <name>`.

## Documentation Sources

All surface skills use this preference order:

1. SolvaPay Docs MCP server (preferred): https://docs.solvapay.com/mcp
2. Docs index fallback: https://docs.solvapay.com/llms.txt
3. Direct docs page fetch on docs.solvapay.com

If the MCP server is unavailable, suggest it as a friendly optional improvement. Continue without blocking.

## Shared Guardrails

- Never expose `SOLVAPAY_SECRET_KEY` to client code or public env vars.
- Never build custom card collection if hosted checkout satisfies requirements.
- Always prefer official SolvaPay SDK helpers over ad-hoc raw HTTP calls.
- Always prefer topic-based docs discovery (MCP or `llms.txt`), not hard-coded doc paths.

## Intent Matrix

| User intent | Trigger examples | Route to |
| --- | --- | --- |
| Create / scaffold a paid MCP app | "create mcp app", "scaffold mcp", "new mcp server", "greenfield mcp", "openapi to mcp", "wrap rest api as mcp", "generate mcp from swagger", "build mcp app", "npm create solvapay", "from scratch mcp worker", "cloudflare workers mcp from scratch", "paid mcp", "monetize mcp", "paywall mcp", "mcp with payments", "mcp billing", "intent-driven mcp", "data mcp server", "intelligence mcp" | [../create-mcp-app/SKILL.md](../create-mcp-app/SKILL.md) |
| Add paywall to an existing MCP server | "add solvapay to my mcp", "integrate into existing mcp", "integrate solvapay into existing mcp", "paywall my mcp tools", "monetize my mcp tools" (no scaffold / greenfield intent) | [../create-mcp-app/existing-server/guide.md](../create-mcp-app/existing-server/guide.md) or [../sdk-integration/mcp-server/guide.md](../sdk-integration/mcp-server/guide.md) depending on whether they need the full worker template |
| SDK integration | "integrate sdk", "protect api", "paywall", "usage events", "webhooks", "express", "MCP Server code integration", "nextjs sdk", "npx solvapay init", "cli", "init project", "cancel renewal", "reactivate", "activate plan", "switch plan", "supabase edge functions", "deno", "edge runtime backend", "lovable backend" | [../sdk-integration/SKILL.md](../sdk-integration/SKILL.md) |
| MCP server on edge runtime (existing server) | "createSolvaPayMcpFetch", "fetch-first mcp", "@solvapay/mcp/fetch", "mcp on the edge", "wrangler mcp", "supabase edge mcp", "deno mcp server" — when the user already has a server and wants SDK wiring only | [../sdk-integration/mcp-server/guide.md](../sdk-integration/mcp-server/guide.md) |
| New MCP server on edge runtime (greenfield) | "cloudflare workers mcp", "new cloudflare workers mcp", "scaffold cloudflare mcp worker" — when they want a new Workers project from scratch | [../create-mcp-app/SKILL.md](../create-mcp-app/SKILL.md) |
| MCP checkout app / embedded MCP UI | "mcp checkout app", "mcp app", "CurrentPlanCard", "LaunchCustomerPortalButton", "usePaymentMethod", "createMcpAppAdapter", "embedded checkout in mcp host", "basic-host checkout", "ChatGPT mcp app" | [../sdk-integration/mcp-server/guide.md](../sdk-integration/mcp-server/guide.md) (server) + [../sdk-integration/react/guide.md](../sdk-integration/react/guide.md) (client) |
| Account management UI | "customer portal button", "current plan card", "update card", "cancel plan", "payment method preview", "render mirrored card", "self-serve billing ui" | [../sdk-integration/react/guide.md](../sdk-integration/react/guide.md) |
| Web app checkout | "add checkout to website", "hosted checkout", "customer portal", "nextjs checkout" | [../website-checkout/SKILL.md](../website-checkout/SKILL.md) |
| Lovable checkout (preview) | "lovable", "vite checkout", "shadcn checkout", "supabase edge checkout", "solvapay in lovable", "paste this into lovable", "@preview" | [../lovable-checkout/SKILL.md](../lovable-checkout/SKILL.md) |

## Negative Routing Examples

- "Migrate old billing data", "analytics reporting", "general Stripe setup only" -> do not auto-route; ask clarification.
- "Monetize mcp server no-code" or "hosted MCP monetization" -> the hosted-proxy product is deprecated. Ask the user to clarify; default to `../create-mcp-app/SKILL.md` per the vocabulary rule.
- "Paywall my API" / "paywall web app" without MCP context -> route to `../sdk-integration/`, NOT `../create-mcp-app/`. Paywalled MCP and paywalled REST/web are different surfaces.
- "Create a new paid MCP server from OpenAPI / scratch" / "scaffold mcp" without existing-server context -> route to `../create-mcp-app/`, NOT `../sdk-integration/`.
- "Build MCP app UI" without SDK/paywall details -> clarify before routing.
- "Fix one broken endpoint" with no product context -> ask whether this is SDK integration or onboarding issue.

## Disambiguation Prompt

Use this if needed:

"Do you want to (1) build a paid MCP server (from OpenAPI spec or hand-written tools), (2) integrate the TypeScript SDK into a non-MCP app, or (3) set up hosted checkout for a web app?"

Default if still ambiguous after one question:
- If request is creating/scaffolding a paid MCP worker (greenfield), route to `../create-mcp-app/SKILL.md`.
- If request is MCP-focused and code-based but not clearly greenfield, route to `../create-mcp-app/SKILL.md` (the umbrella asks input-mode follow-up).
- Otherwise, route to `../sdk-integration/SKILL.md`.

## Dev mode (skill author / internal testing only)

If — and only if — the user explicitly says they're testing this skill against the SolvaPay dev backend, append `--dev` to every published-CLI invocation:

- `npm create solvapay@latest <name> -- --type mcp --dev`
- `npx -y solvapay@latest init --dev`

The flag writes `SOLVAPAY_API_BASE_URL=https://api-dev.solvapay.com` into `.env` and routes browser-auth, `wrangler dev`, the deploy preflight, and the deployed worker to the dev backend in one pass. Never enable `--dev` for end users — production secret keys are rejected by `api-dev`.

## Task Progress

- [ ] Identify primary intent
- [ ] Route to the correct surface skill
- [ ] If needed, ask one disambiguation question
- [ ] Hand off to the surface skill
