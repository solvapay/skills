# MCP Pay No-Code Guide

Set up hosted MCP monetization without adding paywall code to your MCP server.

## Contents

- Guardrails
- When to use this guide
- Prerequisites
- Bootstrap an MCP Pay product
- Configure plans after bootstrap
- What SolvaPay hosts for you
- Verification checklist
- Docs discovery hints

## Guardrails

- Never mix this guide with `payable.mcp()` handler wrapping from SDK integration.
- Never expose `SOLVAPAY_SECRET_KEY` in client-side code or public environment variables.
- Always treat MCP Pay as a hosted proxy workflow: SolvaPay handles auth, paywall enforcement, and billing.
- Always keep tool-to-plan mapping in SolvaPay configuration, not in custom proxy code.

## When to use this guide

Use this guide when the request is no-code or hosted MCP monetization, for example:
- "Set up MCP Pay"
- "Bootstrap MCP product"
- "Add plans to a hosted MCP server"
- "Monetize my MCP server without writing paywall logic"

If the user wants to self-host paywall checks in tool handlers, use
`../sdk-integration/mcp-server/guide.md` instead.

## Prerequisites

- SolvaPay provider account
- Origin MCP server URL available over HTTPS
- Server-side access to `SOLVAPAY_SECRET_KEY`
- `@solvapay/server` installed where bootstrap scripts run

## Bootstrap an MCP Pay product

Use `bootstrapMcpProduct` to create product, plans (free and paid), MCP proxy config, and
tool mapping in one call.

```typescript
import { createSolvaPay } from '@solvapay/server'

const solvaPay = createSolvaPay({
  apiKey: process.env.SOLVAPAY_SECRET_KEY!,
})
```

### Pattern A: free-only launch

Use this when you want to launch quickly with no paid plans yet:

```typescript
const bootstrap = await solvaPay.bootstrapMcpProduct({
  name: 'Docs Assistant',
  originUrl: 'https://origin.example.com/mcp',
  plans: [
    { key: 'free', name: 'Free', price: 0, freeUnits: 0 },
  ],
})
```

### Pattern B: free + paid launch

Use this when you want tiered access from day one:

```typescript
const bootstrap = await solvaPay.bootstrapMcpProduct({
  name: 'Docs Assistant',
  originUrl: 'https://origin.example.com/mcp',
  plans: [
    { key: 'free', name: 'Free', price: 0, freeUnits: 100 },
    { key: 'pro', name: 'Pro', price: 2000, billingCycle: 'monthly' },
  ],
  tools: [
    { name: 'list_docs', planKeys: ['free', 'pro'] },
    { name: 'deep_research', planKeys: ['pro'] },
    { name: 'health_check', noPlan: true },
  ],
})
```

Save these values for follow-up operations:
- `bootstrap.product.reference`
- `bootstrap.mcpServer.mcpProxyUrl`

## Configure plans after bootstrap

Use `configureMcpPlans(productRef, params)` to update plans and tool mapping on an existing MCP
product.

`plans` is optional — send it to replace all plans, or omit to keep existing plans. `toolMapping` is optional.

### Mode 1: replace all plans

```typescript
await solvaPay.configureMcpPlans(productRef, {
  plans: [
    { key: 'free', name: 'Free', price: 0, freeUnits: 100 },
    { key: 'pro', name: 'Pro', price: 2000, billingCycle: 'monthly' },
    { key: 'team', name: 'Team', price: 6000, billingCycle: 'monthly' },
  ],
  toolMapping: [
    { name: 'list_docs', planKeys: ['free', 'pro', 'team'] },
    { name: 'deep_research', planKeys: ['pro', 'team'] },
  ],
})
```

### Mode 2: revert to free-only

```typescript
await solvaPay.configureMcpPlans(productRef, {
  plans: [
    { key: 'free', name: 'Free', price: 0, freeUnits: 0 },
  ],
})
```

### Mode 3: remap tools only

```typescript
await solvaPay.configureMcpPlans(productRef, {
  toolMapping: [{ name: 'deep_research', planKeys: ['pro'] }],
})
```

## What SolvaPay hosts for you

When MCP Pay is enabled, SolvaPay hosts:
- OAuth flows and client registration
- Paywall checks and access gating
- Checkout and customer account pages
- Usage tracking and meter recording
- MCP proxy runtime between clients and your origin server

## Verification checklist

- [ ] Product was created and `mcpProxyUrl` is available
- [ ] Origin MCP tools are discoverable from the proxy URL
- [ ] Free users can call tools assigned to free/default access
- [ ] Paid-only tools return paywall response before purchase
- [ ] After adding paid plans, tool access matches `toolMapping`
- [ ] Revert-to-free mode (single `price: 0` plan) removes paid access as expected

## Docs discovery hints

- `mcp pay overview`
- `create hosted mcp pay product`
- `mcp pay best practices`
- `bootstrap mcp product`
- `configure mcp plans`
