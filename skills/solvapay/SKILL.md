---
name: solvapay
description: >
  Router and disambiguation entry point for the SolvaPay skill family. Use when the user
  asks "add solvapay to my project", "where do I start with solvapay", "what can solvapay
  do", or any ambiguous request that spans multiple SolvaPay surfaces. Owns shared
  documentation-discovery preference and cross-skill guardrails; routes by skill name to
  solvapay/create-mcp-app, solvapay/sdk-integration, solvapay/website-checkout, or
  solvapay/lovable-checkout.
metadata:
  version: "1.0.0"
---

# SolvaPay — Router

Disambiguate vague SolvaPay intent and route to the surface skill that owns the work. This skill catches top-level prompts ("add solvapay to my app") and hosts shared docs-discovery guardrails. It does **not** implement integrations — hand off to a surface skill.

## Handoff contract

1. Pick **one** surface skill from the [Intent matrix](#intent-matrix) (namespaced id, e.g. `solvapay/create-mcp-app`).
2. Tell the user which skill owns the work. If that skill is not installed:

   ```bash
   npx skills add solvapay/skills --skill solvapay/create-mcp-app -y
   ```

   Use the matching id from the matrix (`solvapay/sdk-integration`, `solvapay/website-checkout`, `solvapay/lovable-checkout`).

3. **Stop** — do not implement in this router. Load and follow the target skill's `SKILL.md` once available.

Install all skills (optional convenience):

```bash
npx skills add solvapay/skills --all -y
```

## Quick Start

1. Identify the primary user intent from request keywords.
2. If intent is ambiguous, ask one disambiguation question (see below).
3. Route to exactly one surface skill: `solvapay/create-mcp-app`, `solvapay/sdk-integration`, `solvapay/website-checkout`, or `solvapay/lovable-checkout`.
4. Install the target skill if needed, then follow **its** `SKILL.md` to completion.

## Surface skills

| Skill id | Owns |
| --- | --- |
| `solvapay/create-mcp-app` | Create or scaffold a paid MCP app on Cloudflare Workers (OpenAPI or hand-written) |
| `solvapay/sdk-integration` | TypeScript SDK paywall, checkout, usage, webhooks in existing apps (Next, React, Express, MCP wiring) |
| `solvapay/website-checkout` | Hosted checkout and customer portal for web apps |
| `solvapay/lovable-checkout` | Paste-in preview-only checkout for Lovable (Vite + shadcn/ui + Supabase Edge) |

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

## Gotchas

- This router is valid as a standalone install — it routes by **skill id** (`solvapay/<surface>`), not filesystem paths to sibling folders.
- "Paywall my API" or "paywall web app" without MCP context → `solvapay/sdk-integration`, not `solvapay/create-mcp-app`.
- "Scaffold mcp" / greenfield MCP worker → `solvapay/create-mcp-app`, not `solvapay/sdk-integration`.
- Hosted no-code MCP monetization is deprecated — ask which code-based surface the user wants; default to `solvapay/create-mcp-app`.
- Surface skill descriptions own specific keywords; this router owns ambiguous top-of-funnel prompts only.

## Intent Matrix

| User intent | Trigger examples | Route to skill |
| --- | --- | --- |
| Create / scaffold a paid MCP app | "create mcp app", "scaffold mcp", "new mcp server", "greenfield mcp", "openapi to mcp", "wrap rest api as mcp", "generate mcp from swagger", "build mcp app", "npm create solvapay", "from scratch mcp worker", "cloudflare workers mcp from scratch", "paid mcp", "monetize mcp", "paywall mcp", "mcp with payments", "mcp billing", "intent-driven mcp", "data mcp server", "intelligence mcp" | `solvapay/create-mcp-app` |
| Add paywall to an existing MCP server | "add solvapay to my mcp", "integrate into existing mcp", "paywall my mcp tools", "monetize my mcp tools" (no scaffold intent) | `solvapay/create-mcp-app` if they need audit + worker template guidance; else `solvapay/sdk-integration` for SDK wiring only |
| SDK integration | "integrate sdk", "protect api", "paywall", "usage events", "webhooks", "express", "nextjs sdk", "npx solvapay init", "cli", "init project", "cancel renewal", "reactivate", "activate plan", "switch plan", "supabase edge functions", "deno", "edge runtime backend" | `solvapay/sdk-integration` |
| MCP server on edge (existing server) | "createSolvaPayMcpFetch", "fetch-first mcp", "@solvapay/mcp/fetch", "mcp on the edge", "wrangler mcp", "supabase edge mcp", "deno mcp server" | `solvapay/sdk-integration` |
| New MCP server on edge (greenfield) | "cloudflare workers mcp", "new cloudflare workers mcp", "scaffold cloudflare mcp worker" | `solvapay/create-mcp-app` |
| MCP checkout app / embedded MCP UI | "mcp checkout app", "mcp app", "CurrentPlanCard", "LaunchCustomerPortalButton", "usePaymentMethod", "createMcpAppAdapter", "embedded checkout in mcp host", "ChatGPT mcp app" | `solvapay/sdk-integration` |
| Account management UI | "customer portal button", "current plan card", "update card", "cancel plan", "payment method preview", "self-serve billing ui" | `solvapay/sdk-integration` |
| Web app checkout | "add checkout to website", "hosted checkout", "customer portal", "nextjs checkout" | `solvapay/website-checkout` |
| Lovable checkout (preview) | "lovable", "vite checkout", "shadcn checkout", "supabase edge checkout", "solvapay in lovable", "paste this into lovable", "@preview" | `solvapay/lovable-checkout` |

## Negative Routing Examples

- "Migrate old billing data", "analytics reporting", "general Stripe setup only" → do not auto-route; ask clarification.
- "Monetize mcp server no-code" or "hosted MCP monetization" → deprecated product; ask clarification; default skill `solvapay/create-mcp-app`.
- "Paywall my API" / "paywall web app" without MCP context → `solvapay/sdk-integration`, NOT `solvapay/create-mcp-app`.
- "Create a new paid MCP server from OpenAPI / scratch" / "scaffold mcp" without existing-server context → `solvapay/create-mcp-app`, NOT `solvapay/sdk-integration`.
- "Build MCP app UI" without SDK/paywall details → clarify before routing.
- "Fix one broken endpoint" with no product context → ask whether SDK integration or onboarding.

## Disambiguation Prompt

Use this if needed:

"Do you want to (1) build a paid MCP server (from OpenAPI spec or hand-written tools), (2) integrate the TypeScript SDK into a non-MCP app, or (3) set up hosted checkout for a web app?"

Default if still ambiguous after one question:

- Creating/scaffolding a paid MCP worker (greenfield) → `solvapay/create-mcp-app`
- MCP-focused and code-based but not clearly greenfield → `solvapay/create-mcp-app` (surface skill asks input-mode follow-up)
- Otherwise → `solvapay/sdk-integration`

## Dev mode (skill author / internal testing only)

If — and only if — the user explicitly says they're testing against the SolvaPay dev backend, append `--dev` to every published-CLI invocation:

- `npm create solvapay@latest <name> -- --type mcp --dev`
- `npx -y solvapay@latest init --dev`

The flag writes `SOLVAPAY_API_BASE_URL=https://api-dev.solvapay.com` into `.env` and routes browser-auth, `wrangler dev`, deploy preflight, and the deployed worker to api-dev. Never enable `--dev` for end users — production keys are rejected by api-dev.

## Task Progress

- [ ] Identify primary intent
- [ ] Pick surface skill id from intent matrix (`solvapay/<surface>`)
- [ ] Install target skill if needed (`npx skills add solvapay/skills --skill solvapay/<surface> -y`)
- [ ] Hand off — follow target skill's `SKILL.md`; do not implement here
