---
name: website-checkout
description: >
  Add SolvaPay hosted checkout and customer portal to a web app with minimal PCI surface.
  Use when the user says "add checkout to website", "hosted checkout", "customer portal",
  "nextjs checkout", "checkout session", or wants a server-side checkout-session route plus
  a return-URL handler. Next.js is fully supported; React (no Next.js) gets partial guidance.
  Use the `sdk-integration` skill instead for usage metering, Express, MCP server wiring,
  or webhook-heavy flows; use `lovable-checkout` for Lovable / Vite / Supabase Edge apps.
---

# Website Checkout

Hosted checkout + customer portal for web apps. Server creates the checkout session, browser redirects to SolvaPay, return URL handler refreshes access state from server truth.

## Quick Start

1. Read [guide.md](guide.md) — stack detection, guardrails, handoff output.
2. Run `npx -y solvapay@latest init` to configure `SOLVAPAY_SECRET_KEY` and install base SDK packages.
3. Follow the matching stack guide:
   - [nextjs/guide.md](nextjs/guide.md) — fully supported
   - [react/guide.md](react/guide.md) — partial guidance (you still need a backend)

For advanced flows (usage metering, Express, MCP, custom webhooks) use the [`sdk-integration`](../sdk-integration/SKILL.md) skill instead.

## Guardrails

- Never build custom card forms when hosted checkout is acceptable.
- Never expose `SOLVAPAY_SECRET_KEY` in client code.
- Always keep checkout session creation on the server.
- Always verify access state from server truth after returning from checkout.
- Always use SolvaPay naming in user-facing text.
