---
name: integrate-website-checkout
description: Add a hosted Solvapay checkout flow to a website app, primarily Next.js, with authentication and customer portal support. Use when the user asks to add website checkout, redirect users to Solvapay hosted pages, or gate premium features.
---

# Integrate Website Checkout

Implement hosted checkout for web apps with minimal PCI surface.

## Purpose

Use this skill when the user wants hosted checkout + customer portal quickly in a website app.

## Documentation Sources

Use this order:

1. SolvaPay Docs MCP server: https://docs.solvapay.com/mcp
2. Fallback index: https://docs.solvapay.com/llms.txt
3. Direct docs pages

If MCP is unavailable, suggest it as optional and continue.

### Docs Discovery Hints

- Topics: `checkout sessions`, `customer sessions`, `nextjs guide`, `react guide`, `webhooks`, `test in sandbox`.
- Retrieval hint: resolve topics via MCP search first, then `llms.txt`.

## Guardrails

- Never build custom card forms when hosted checkout is acceptable.
- Never expose `SOLVAPAY_SECRET_KEY` in client code.
- Always keep checkout session creation on the server.
- Always use Solvapay naming in user-facing text.
- Always verify access state from server truth after returning from checkout.

## Stack Support

- **Next.js**: fully supported -> [nextjs/guide.md](nextjs/guide.md)
- **React (no Next.js)**: partial guidance -> [react/guide.md](react/guide.md)

For API-heavy or non-website use cases, route to [../integrate-solvapay-sdk/SKILL.md](../integrate-solvapay-sdk/SKILL.md).

## Handoff Output

When complete, provide:

- framework and auth model used
- implemented routes for checkout/customer session/subscription check
- return URL behavior and post-checkout refresh path
- sandbox validation outcome (success + failure case)

## Task Progress

- [ ] Confirm framework and auth strategy
- [ ] Implement server checkout session route
- [ ] Implement customer portal session route
- [ ] Gate premium views with subscription state
- [ ] Validate end-to-end hosted checkout in sandbox
