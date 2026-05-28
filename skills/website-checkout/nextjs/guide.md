# Next.js Hosted Checkout Guide

Use this guide to add SolvaPay hosted checkout and customer portal in App Router projects.

## Docs References (Topic-Based)

- Topics: `nextjs guide`, `checkout sessions`, `customer sessions`, `webhooks`, `test in sandbox`.
- Retrieval hint: resolve topics via MCP first, fallback to `llms.txt`.

## Steps

1. [01-setup.md](01-setup.md)
2. [02-authentication.md](02-authentication.md)
3. [03-checkout-and-portal.md](03-checkout-and-portal.md)

## What You Build

- Authenticated user identity flow
- API route to create checkout session URL
- API route to create customer portal URL
- Frontend redirects to hosted pages
- Purchase/access-aware UI states

## Verification Flow

1. Unauthenticated user is blocked from checkout endpoints.
2. Authenticated user receives checkout URL.
3. User returns from hosted checkout.
4. App refreshes purchase/access state and unlocks features.
5. Customer portal redirect works.

## Troubleshooting

- Route returns 500 -> missing server env or product/customer mapping.
- Return to app but still locked -> no purchase/access refresh or stale backend state.
- Portal URL missing -> customer session route payload invalid.

## Note

For advanced SDK patterns (usage metering, Express/MCP paths, webhook-heavy flows), see [../../sdk-integration/guide.md](../../sdk-integration/guide.md).
