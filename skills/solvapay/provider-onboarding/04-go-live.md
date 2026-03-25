# Step 4: Go Live

Switch account mode only after sandbox checks pass.

## Docs References (Topic-Based)

- Topics: `go live`, `mode switch`, `webhook monitoring`, `failed payments`, `live mode`.
- Retrieval hint: resolve onboarding topics via MCP first, fallback to `llms.txt`.

## Required Preconditions

- At least one product exists with a plan configured in product setup
- Stripe setup is complete from dashboard (existing account connected or new account created)
- Sandbox integration tests are complete

## Actions

1. Switch account mode from sandbox to live in SolvaPay Console header.
2. Replace sandbox credentials with live credentials where applicable.
3. Run one controlled live checkout test.
4. Monitor first real transactions and webhook deliveries.

## Acceptance Criteria

- [ ] Live mode is active
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
