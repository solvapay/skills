# Provider Onboarding Guide

Guide provider setup with a lightweight, docs-first flow.

## Purpose

Use this guide for operational onboarding of a provider account, not application code implementation.
Keep instructions minimal here and use docs topic pages for detailed procedures.

## Steps

Follow these files in order:

1. [01-create-account.md](01-create-account.md)
2. [02-create-product-and-plan.md](02-create-product-and-plan.md)
3. [03-test-in-sandbox.md](03-test-in-sandbox.md)
4. [04-go-live.md](04-go-live.md)

Canonical sequence:
- Sign up or log in.
- Complete provider onboarding fields: company name, website URL, country, currency.
- Create first product and configure plans within that product, then choose path (Hosted MCP Pay or SDK).
- Continue from dashboard and complete Stripe setup (connect existing account or create a new one).

## Docs Discovery Hints

- Onboarding topics: `create account`, `create product`, `test in sandbox`, `go live`.
- Runtime topics for coordination with engineering: `webhooks`, `checkout session`, `usage limits`.

## Guardrails

- Never skip sandbox validation before switching to live mode.
- Never launch with missing webhook verification or unresolved failed-payment handling.
- Always confirm product and plan references before sharing integration instructions.
- Always capture handoff outputs for engineering teams before closing onboarding.

## Handoff Outputs (Required)

At completion provide:

- account mode status (sandbox/live)
- product and plan references
- payment provider connection status
- webhook endpoint status and verification status
- unresolved risks and owner for follow-up

## Task Progress

- [ ] Account is created and provider onboarding fields are completed
- [ ] First product is created and plan is configured within product setup
- [ ] Integration path is chosen (Hosted MCP Pay or SDK)
- [ ] Stripe setup is completed from dashboard (existing or new account)
- [ ] Sandbox purchase flow is tested end to end
- [ ] Go-live checklist is complete
