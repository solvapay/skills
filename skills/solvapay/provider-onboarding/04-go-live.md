# Step 4: Go Live

Switch account mode only after sandbox checks pass.

## Docs References (Topic-Based)

- Topics: `go live`, `mode switch`, `webhook monitoring`, `failed payments`, `live mode`.
- Retrieval hint: resolve onboarding topics via MCP first, fallback to `llms.txt`.

## Required Preconditions

- At least one product exists with a plan configured in product setup
- Sandbox integration tests are complete
- Email is verified, business details are complete, and two-factor
  authentication is enabled on the owner account

## Actions

1. Open Go-Live flow from the dashboard card or the environment toggle.
2. Walk through the Go-Live checklist (email verified, product created,
   business details, two-factor authentication).
3. Connect Stripe for live payments: choose "Connect existing account" (OAuth) or "Create new account."
4. Choose whether to copy sandbox products to the live environment.
5. Confirm and switch to live mode.
6. Replace sandbox credentials with live credentials where applicable.
7. Run one controlled live checkout test.
8. Monitor first real transactions and webhook deliveries.

## Acceptance Criteria

- [ ] Live mode is active
- [ ] Two-factor authentication is enabled on the owner account
- [ ] Stripe account is connected for live payments
- [ ] Real payment succeeds for a test user
- [ ] Webhooks are received and verified
- [ ] SolvaPay Console shows expected live usage/revenue events
- [ ] On-call owner is assigned for first 24-48 hours

## Post-Launch

- Keep sandbox available for future test cycles.
- Add alerts for failed payments and unusual usage spikes.

## Rollback / Incident Checklist

- [ ] Switch operational testing back to sandbox if severe issues appear
- [ ] Pause new paid feature launches while incident is active
- [ ] Validate payment provider status and webhook health
- [ ] Communicate incident status and ETA to stakeholders
- [ ] Document root cause and follow-up prevention tasks
