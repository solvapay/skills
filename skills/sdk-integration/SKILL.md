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
metadata:
  version: "1.0.0"
---

# SDK Integration

Add SolvaPay to an existing TypeScript / JavaScript app via the `@solvapay/*` packages.

## Quick Start

1. Detect stack from `package.json` (see [Stack Detection Rules](#stack-detection-rules)).
2. Run `npx -y solvapay@latest init` to authenticate and install base packages (`@solvapay/server`, `@solvapay/core`, `@solvapay/auth`).
3. Follow the matching stack reference:
   - [references/nextjs.md](references/nextjs.md)
   - [references/react.md](references/react.md)
   - [references/express.md](references/express.md)
   - [references/mcp-server.md](references/mcp-server.md) — fetch-first MCP server already in place (Cloudflare Workers, Supabase Edge, Deno)
   - [references/supabase-edge.md](references/supabase-edge.md)
4. Use [references/REFERENCE.md](references/REFERENCE.md) for the package map and API operations; [references/WEBHOOKS.md](references/WEBHOOKS.md) for signature verification.

## Stack Detection Rules

Detect stack from `package.json`:

- `next` dependency present → follow [references/nextjs.md](references/nextjs.md)
- `react` present and `next` absent → follow [references/react.md](references/react.md) plus backend contract
- `express` present → follow [references/express.md](references/express.md)
- `@modelcontextprotocol/*` present → follow [references/mcp-server.md](references/mcp-server.md)
- `supabase/functions/` directory exists OR `@supabase/supabase-js` present without `next`/`express` → follow [references/supabase-edge.md](references/supabase-edge.md)
- Deno project without Node framework → follow [references/supabase-edge.md](references/supabase-edge.md)
- If multiple match, ask which runtime is primary for paid operations.
- If React + Supabase but unsure about backend: "Does the project already have a Next.js backend, or is the backend entirely on Supabase Edge Functions?"

## When To Ask Clarifying Questions

Ask one question if any of these are missing:

- hosted checkout vs embedded payment intent preference
- auth system (Supabase, custom JWT, session auth)
- monetization model (purchase gate vs usage limits vs both)
- target runtime for protected operations (edge vs node)

## Implementation Order

1. Run `npx -y solvapay@latest init` to authenticate and install base SDK packages.
2. Confirm product exists with required plans in SolvaPay Console.
3. Implement customer identity mapping from your auth layer.
4. Add paywall / checkout flow.
5. Add webhook handling for source-of-truth updates.
6. Validate in sandbox before go-live.

### Stage 1: Setup

- Run `npx -y solvapay@latest init` to authenticate, set `SOLVAPAY_SECRET_KEY` in `.env`, add `.env` to `.gitignore`, and install base packages: `@solvapay/server`, `@solvapay/core`, `@solvapay/auth`.
- Install additional stack-specific packages not covered by init (for example `@solvapay/next`, `@solvapay/react`, `@solvapay/react-supabase`).
- Use manual package installation only as a fallback when CLI setup cannot run (for example CI images or restricted build environments).
- Confirm server-side secret handling (`SOLVAPAY_SECRET_KEY` only on server).
- Ensure product and plan references are available before coding UI gates.

Topics: `typescript sdk intro`, `installation`, `quick start`, `core concepts`.

### Stage 2: Auth and Customer Mapping

- Map authenticated user identity to a stable SolvaPay customer reference.
- For JWT/session auth, ensure customer identity is extracted in server middleware / handler.
- Add customer sync / ensure step before checkout or limits checks.

Topics: `custom auth`, `nextjs auth middleware`, `customer`.

### Stage 3: Paywall and Checkout

- Choose hosted checkout by default.
- Use limits checks for metered flows and checkout session for upgrade path.
- Return actionable errors (401/402) with upgrade guidance or checkout URL.
- For free or credit-based plans, use `activatePlan` as an alternative to checkout.
- For post-purchase lifecycle management, use `cancelRenewal` and `reactivateRenewal`.
- For plan switching, call `activatePlan` with a different plan — the old purchase is automatically expired.

Topics: `checkout sessions`, `customer sessions`, `limits`, `usage`, `purchase management`, `activate plan`.

### Stage 4: Webhooks and Sync

- Add webhook endpoint with signature verification.
- Process purchase / payment events idempotently.
- Keep local access state and billing state in sync.
- See [references/WEBHOOKS.md](references/WEBHOOKS.md) for implementation patterns.

Topics: `webhooks`, `verify signature`, `purchase events`, `payment events`.

### Stage 5: Sandbox Verification

- Validate one successful paid path.
- Validate one failure path (unauthorized, limit exceeded, or declined payment).
- Capture runbook notes for go-live (keys, endpoints, verification status).

Topics: `test in sandbox`, `go live`, `testing`, `error handling`.

## Guardrails

- Never expose `SOLVAPAY_SECRET_KEY` to client code or public env vars.
- Never build custom card collection if hosted checkout satisfies requirements.
- Always prefer official SolvaPay SDK helpers over ad-hoc raw HTTP calls.
- Always confirm product and plan references exist before wiring UI.
- Always keep paywall checks server-side or tool-handler-side (never browser-only).
- Always include a failure-path test in sandbox before calling implementation complete.
- Never rely on SDK repo examples as required source material.
- Never treat UI unlock state as authoritative without server-side checks.

## When NOT to use this skill

- Scaffolding a brand-new paid MCP server from OpenAPI or from scratch — use `create-mcp-app` instead.
- Pasting hosted checkout into a Lovable app — use `lovable-checkout` instead.
- Adding hosted checkout to a brand-new Next.js / React web app with no other SDK needs — `website-checkout` covers the minimal slice.

## Verification Loop

1. Run stack-specific dev flow.
2. Execute one happy-path purchase / paywall request.
3. Trigger one failure path (exceeded limit or unauthorized request).
4. Verify logs + returned checkout URL / message.
5. Fix and re-test before adding more features.

## Troubleshooting Triggers

- 401 everywhere → auth extraction / middleware likely broken.
- 402 never appears → limits / product / plan mapping likely incorrect.
- Checkout succeeds but access unchanged → missing webhook or stale access cache.
- Signature failures in webhook endpoint → wrong secret or raw body parsing issue.

## Handoff Output

When this domain completes, provide:

- selected stack and runtime
- implemented operations (checkout, customer portal, limits, usage, webhooks)
- environment variables used
- verified test outcomes (happy path and failure path)

## Task Progress

- [ ] Detect stack and runtime
- [ ] Wire SDK packages and env vars
- [ ] Implement checkout / paywall flow
- [ ] Add auth-aware customer mapping
- [ ] Add webhook handling if needed
- [ ] Verify with sandbox tests
