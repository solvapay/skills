---
name: sdk-integration
description: >
  Integrate the SolvaPay TypeScript SDK into an existing app -- Next.js, React, Express,
  Supabase Edge Functions, Deno, or an MCP server that already exists. Use when the user
  says "integrate sdk", "protect api", "paywall my api", "usage events", "webhooks",
  "add solvapay to existing mcp", "supabase edge functions", "npx solvapay init", or wants
  account-management UI (CurrentPlanCard, LaunchCustomerPortalButton, usePaymentMethod).
  Covers paywall enforcement, usage tracking, hosted checkout, customer portal, plan
  activation / cancellation / reactivation, and webhook signature verification. Use the
  `create-mcp-app` skill instead when scaffolding a brand-new paid MCP server.
---

# SDK Integration

Add SolvaPay to an existing TypeScript / JavaScript app via the `@solvapay/*` packages.

## Quick Start

1. Read [guide.md](guide.md) — the entry point with stack detection, clarifying questions, and the implementation order (init → auth mapping → paywall → webhooks → sandbox).
2. Run `npx -y solvapay@latest init` to authenticate and install base packages (`@solvapay/server`, `@solvapay/core`, `@solvapay/auth`).
3. Follow the matching stack guide:
   - [nextjs/guide.md](nextjs/guide.md)
   - [react/guide.md](react/guide.md)
   - [express/guide.md](express/guide.md)
   - [mcp-server/guide.md](mcp-server/guide.md) — fetch-first MCP server already in place (Cloudflare Workers, Supabase Edge, Deno)
   - [supabase-edge/guide.md](supabase-edge/guide.md)
4. Use [reference.md](reference.md) for package map and API operations; [webhooks.md](webhooks.md) for signature verification.

## Guardrails

- Never expose `SOLVAPAY_SECRET_KEY` to client code or public env vars.
- Never build custom card collection if hosted checkout satisfies requirements.
- Always prefer official SolvaPay SDK helpers over ad-hoc raw HTTP calls.
- Always keep paywall checks server-side or tool-handler-side (never browser-only).
- Always include a failure-path test in sandbox before calling implementation complete.

## When NOT to use this skill

- Scaffolding a brand-new paid MCP server from OpenAPI or from scratch — use `create-mcp-app` instead.
- Pasting hosted checkout into a Lovable app — use `lovable-checkout` instead.
- Adding hosted checkout to a brand-new Next.js / React web app with no other SDK needs — `website-checkout` covers the minimal slice.
