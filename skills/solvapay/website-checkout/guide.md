# Website Checkout Guide

Implement hosted checkout for web apps with minimal PCI surface.

## Purpose

Use this guide when the user wants hosted checkout + customer portal quickly in a web app.
This guide is for web checkout flows, not paid MCP server implementation.

## Stack Support

- **Next.js**: fully supported -> [nextjs/guide.md](nextjs/guide.md)
- **React (no Next.js)**: partial guidance -> [react/guide.md](react/guide.md)

## Prerequisites

Before stack-specific implementation, run `npx solvapay init` to configure
`SOLVAPAY_SECRET_KEY` and install base SDK packages.

For advanced use cases (usage metering, Express/MCP paths, webhook-heavy flows), use [../sdk-integration/guide.md](../sdk-integration/guide.md).

## Docs Discovery Hints

- Topics: `checkout sessions`, `customer sessions`, `nextjs guide`, `react guide`, `webhooks`, `test in sandbox`.
- Retrieval hint: resolve topics via MCP search first, then `llms.txt`.

## Guardrails

- Never build custom card forms when hosted checkout is acceptable.
- Never expose `SOLVAPAY_SECRET_KEY` in client code.
- Always keep checkout session creation on the server.
- Always use SolvaPay naming in user-facing text.
- Always verify access state from server truth after returning from checkout.

## Handoff Output

When complete, provide:

- framework and auth model used
- implemented routes for checkout/customer session/access check
- return URL behavior and post-checkout refresh path
- sandbox validation outcome (success + failure case)

## Task Progress

- [ ] Confirm framework and auth strategy
- [ ] Implement server checkout session route
- [ ] Implement customer portal session route
- [ ] Gate premium views with purchase/access state
- [ ] Validate end-to-end hosted checkout in sandbox
