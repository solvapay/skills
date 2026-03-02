# SDK Integration Guide

Choose one stack path and implement from smallest viable flow to full production flow.

## Purpose

Use this guide when the user wants to integrate Solvapay monetization into application code, APIs, or MCP tools.

## Implementation Order

1. Install SDK packages and configure env vars.
2. Implement customer identity mapping from your auth layer.
3. Add paywall/checkout flow.
4. Add webhook handling for source-of-truth updates.
5. Validate in sandbox before go-live.

## Stage 1: Setup

- Install required SDK packages for selected stack.
- Confirm server-side secret handling (`SOLVAPAY_SECRET_KEY` only on server).
- Ensure product and plan references are available before coding UI gates.

### Docs References (Topic-Based)

- Topics: `typescript sdk intro`, `installation`, `quick start`, `core concepts`.
- Retrieval hint: resolve these topics via MCP search first, fallback to `llms.txt` index scan.

## Stage 2: Auth and Customer Mapping

- Map authenticated user identity to stable Solvapay customer reference.
- For JWT/session auth, ensure customer identity is extracted in server middleware/handler.
- Add customer sync/ensure step before checkout or limits checks.

### Docs References (Topic-Based)

- Topics: `custom auth`, `nextjs auth middleware`, `customer`.
- Retrieval hint: search guides first, then API customer endpoints if implementation details are needed.

## Stage 3: Paywall and Checkout

- Choose hosted checkout by default.
- Use limits checks for metered flows and checkout session for upgrade path.
- Return actionable errors (401/402) with upgrade guidance or checkout URL.

### Docs References (Topic-Based)

- Topics: `checkout sessions`, `customer sessions`, `limits`, `usage`.
- Retrieval hint: resolve API reference pages for exact request/response shapes.

## Stage 4: Webhooks and Sync

- Add webhook endpoint with signature verification.
- Process purchase/payment events idempotently.
- Keep local access state and billing state in sync.

### Docs References (Topic-Based)

- Topics: `webhooks`, `verify signature`, `purchase events`, `payment events`.
- Retrieval hint: fetch only verification + event handling sections.

## Stage 5: Sandbox Verification and Go-Live Handoff

- Validate one successful paid path.
- Validate one failure path (unauthorized, limit exceeded, or declined payment).
- Capture runbook notes for go-live (keys, endpoints, verification status).

### Docs References (Topic-Based)

- Topics: `test in sandbox`, `go live`, `testing`, `error handling`.
- Retrieval hint: use getting started + testing domains before deep API references.

## Stack Paths

- **Next.js**: [nextjs/guide.md](nextjs/guide.md)
- **React**: [react/guide.md](react/guide.md)
- **Express**: [express/guide.md](express/guide.md)
- **MCP server**: [mcp-server/guide.md](mcp-server/guide.md)

## Guardrails

- Never rely on SDK repo examples as required source material.
- Always use docs-driven discovery (MCP/`llms.txt`) for current API shapes.
- Never treat UI unlock state as authoritative without server-side checks.

## Verification Loop

1. Run stack-specific dev flow.
2. Execute one happy-path purchase/paywall request.
3. Trigger one failure path (exceeded limit or unauthorized request).
4. Verify logs + returned checkout URL/message.
5. Fix and re-test before adding more features.

## Troubleshooting Triggers

- 401 everywhere -> auth extraction/middleware likely broken.
- 402 never appears -> limits/product/plan mapping likely incorrect.
- Checkout succeeds but access unchanged -> missing webhook or stale access cache.
- Signature failures in webhook endpoint -> wrong secret or raw body parsing issue.
