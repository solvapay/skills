# MCP Server SDK Guide

Protect MCP tools using Solvapay paywall adapters.

## Docs References (Topic-Based)

- Topics: `mcp guide`, `tool protection`, `limits`, `usage`, `error handling`, `testing`.
- Retrieval hint: resolve MCP guide topic first, then limits/usage API topics as needed.

## Recommended Flow

1. Initialize Solvapay server client.
2. Build tool handlers with stable `customer_ref` input.
3. Wrap handlers with `payable.mcp(...)`.
4. Return payment-required errors with checkout URL when limits are exceeded.
5. Track usage after successful tool execution when monetization model requires metering.

## Tool Schema Requirement

- Each protected tool must accept auth context with customer identity.
- Require `auth.customer_ref` in tool input schema for deterministic access checks.

## Transport Notes

- Support stdio for local MCP clients.
- Use Streamable HTTP transport when external access is needed.
- Validate session and protocol headers on HTTP transport.

## Paywall Error Shape (Client Recovery)

MCP client should receive a machine-readable payment-required error containing:

- product/plan context
- checkout URL (when applicable)
- user-facing message

Client should surface upgrade action and allow retry after purchase.

## Verification Checklist

- [ ] Protected tool denies over-limit calls with payment-required error
- [ ] Authorized/in-limit calls execute tool logic successfully
- [ ] Customer reference is required and validated
- [ ] Transport mode (stdio/http) behaves consistently for access checks

## Guardrails

- Never execute paid tool logic before paywall check.
- Never assume anonymous users share one usage bucket.

## Troubleshooting

- Tool always blocked -> missing/invalid `customer_ref`.
- Tool never blocked -> wrapper not applied or product config mismatch.
- MCP HTTP inconsistencies -> session/protocol headers not preserved across calls.
