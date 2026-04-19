# Step 3: Test in Sandbox

Validate end-to-end behavior before enabling live mode.

## Docs References (Topic-Based)

- Topics: `test in sandbox`, `checkout`, `limits`, `usage tracking`, `webhooks`.
- Retrieval hint: resolve onboarding + relevant SDK/API topics via MCP then `llms.txt`.

## Actions

1. Run checkout flow with Stripe test cards (sandbox Stripe is
   auto-provisioned after business details are submitted during onboarding).
2. Verify paywall behavior on protected routes/tools.
3. Verify successful payment unlocks access.
4. Verify usage and purchases appear in SolvaPay Console.
5. Verify declined payment path and error messaging.
6. Verify webhook delivery and signature verification path.

## Recommended Test Cards

- `4242 4242 4242 4242` (success)
- `4000 0000 0000 0002` (declined)

Use any future expiry and any CVC.

## Acceptance Criteria

- [ ] Free limits are enforced
- [ ] Upgrade path is shown when blocked
- [ ] Successful payment grants access
- [ ] Failed payment does not grant access
- [ ] Usage and purchase records are visible in SolvaPay Console
- [ ] Webhook events are received and processed without signature failures

## Failure Remediation

- Checkout works but access not granted -> verify webhook processing and access sync logic.
- Limits not enforced -> verify product/plan mapping and customer identity consistency.
- SolvaPay Console usage missing -> verify usage event recording path and environment mode.
