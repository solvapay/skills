---
name: website-checkout
description: >
  Add SolvaPay hosted checkout and customer portal to a web app with minimal PCI surface.
  Use when the user says "add checkout to website", "hosted checkout", "customer portal",
  "nextjs checkout", "checkout session", or wants a server-side checkout-session route plus
  a return-URL handler. Next.js is fully supported; React (no Next.js) gets partial guidance.
  Use the `sdk-integration` skill instead for usage metering, Express, MCP server wiring,
  or webhook-heavy flows; use `lovable-checkout` for Lovable / Vite / Supabase Edge apps.
metadata:
  version: "1.0.0"
compatibility: >
  Requires Node.js >= 18.17 for npx solvapay init. Next.js fully supported; React
  (no Next.js) partial. Network access required for init and hosted checkout.
---

# Website Checkout

Hosted checkout + customer portal for web apps. Server creates the checkout session, browser redirects to SolvaPay, return URL handler refreshes access state from server truth.

## Stack Support

- **Next.js**: fully supported → [references/nextjs.md](references/nextjs.md)
- **React (no Next.js)**: partial guidance → [references/react.md](references/react.md)

## Prerequisites

Before stack-specific implementation, run `npx -y solvapay@latest init` to configure `SOLVAPAY_SECRET_KEY` and install base SDK packages.

For advanced use cases (usage metering, Express/MCP paths, webhook-heavy flows), use the [`sdk-integration`](../sdk-integration/SKILL.md) skill.

## Quick Start

1. Run `npx -y solvapay@latest init` to configure `SOLVAPAY_SECRET_KEY` and install base SDK packages.
2. Follow the matching stack guide: [references/nextjs.md](references/nextjs.md) or [references/react.md](references/react.md).

## Guardrails

- Never build custom card forms when hosted checkout is acceptable.
- Never expose `SOLVAPAY_SECRET_KEY` in client code.
- Always keep checkout session creation on the server.
- Always verify access state from server truth after returning from checkout.
- Always use SolvaPay naming in user-facing text.

## Gotchas

- Checkout succeeds in the browser but access unchanged usually means missing webhooks or stale client-side cache — refresh from server truth on the return URL.
- React-only apps need a backend for checkout session creation — this skill covers partial guidance; full SDK wiring may need `sdk-integration`.
- Lovable / Vite + Supabase Edge apps should use `lovable-checkout`, not this skill.

## Verification loop

1. Run stack-specific dev flow.
2. Execute one happy-path hosted checkout (redirect → return URL → access granted).
3. Trigger one failure path (declined payment or unauthorized access check).
4. Verify server-side access state matches UI after return.
5. Fix and re-test before calling implementation complete.

## Docs Discovery Hints

- Topics: `checkout sessions`, `customer sessions`, `nextjs guide`, `react guide`, `webhooks`, `test in sandbox`.
- Retrieval hint: resolve topics via MCP search first, then `llms.txt`.

## Handoff Output

When complete, provide:

- framework and auth model used
- implemented routes for checkout / customer session / access check
- return URL behavior and post-checkout refresh path
- sandbox validation outcome (success + failure case)

## Task Progress

- [ ] Confirm framework and auth strategy
- [ ] Implement server checkout session route
- [ ] Implement customer portal session route
- [ ] Gate premium views with purchase / access state
- [ ] Validate end-to-end hosted checkout in sandbox
