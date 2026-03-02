---
name: integrate-solvapay-sdk
description: Integrate the Solvapay TypeScript SDK into Next.js, React, Express, or MCP server projects. Use when the user asks to add paywall protection, checkout sessions, customer sessions, usage tracking, or webhooks with Solvapay.
---

# Integrate Solvapay SDK

Implement Solvapay SDK integration with stack-specific guides and shared references.

## Quick Start

1. Detect stack from `package.json`.
2. Read the matching stack guide:
   - [nextjs/guide.md](nextjs/guide.md)
   - [react/guide.md](react/guide.md)
   - [express/guide.md](express/guide.md)
   - [mcp-server/guide.md](mcp-server/guide.md)
3. Use [reference.md](reference.md) for shared API patterns.
4. Use [webhooks.md](webhooks.md) when webhook handling is required.

## Stack Detection Rules

- `next` dependency present -> follow `nextjs/guide.md`
- `react` present and `next` absent -> follow `react/guide.md` plus backend contract
- `express` present -> follow `express/guide.md`
- `@modelcontextprotocol/*` present -> follow `mcp-server/guide.md`
- If multiple match, ask which runtime is primary for paid operations.

## When To Ask Clarifying Questions

Ask one question if any of these are missing:

- hosted checkout vs embedded payment intent preference
- auth system (Supabase, custom JWT, session auth)
- monetization model (purchase gate vs usage limits vs both)
- target runtime for protected operations (edge vs node)

## Documentation Sources

Use this order:

1. SolvaPay Docs MCP server: https://docs.solvapay.com/mcp
2. Fallback index: https://docs.solvapay.com/llms.txt
3. Direct docs pages

If MCP is unavailable, suggest it as optional and continue.

### Docs Discovery Hints

- SDK intro/getting started: search topics `typescript sdk intro`, `installation`, `quick start`.
- Framework guides: search topics `nextjs`, `react`, `express`, `mcp`.
- Reliability topics: search topics `webhooks`, `error handling`, `testing`.
- API operation details: search topics `checkout sessions`, `customer sessions`, `limits`, `usage`, `payment intents`.

## Guardrails

- Never expose `SOLVAPAY_SECRET_KEY` to client code or public env vars.
- Never build custom card collection if hosted checkout satisfies requirements.
- Always prefer official Solvapay SDK helpers over ad-hoc raw HTTP calls.
- Always confirm product and plan references exist before wiring UI.
- Always keep paywall checks server-side or tool-handler-side (never browser-only).
- Always include a failure-path test in sandbox before calling implementation complete.

## Shared Guides

- [guide.md](guide.md) - integration flow and decision points
- [reference.md](reference.md) - common API operations and package map
- [webhooks.md](webhooks.md) - signature verification and event handling

## Handoff Output

When this skill completes, the output should include:

- selected stack and runtime
- implemented operations (checkout, customer portal, limits, usage, webhooks)
- environment variables used
- verified test outcomes (happy path and failure path)

## Task Progress

- [ ] Detect stack and runtime
- [ ] Wire SDK packages and env vars
- [ ] Implement checkout/paywall flow
- [ ] Add auth-aware customer mapping
- [ ] Add webhook handling if needed
- [ ] Verify with sandbox tests
