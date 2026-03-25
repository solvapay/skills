# Step 1: Create Account

Create provider account and complete the initial onboarding form.

## Docs References (Topic-Based)

- Topics: `create account`, `provider onboarding`, `company profile`.
- Retrieval hint: resolve topics via MCP first, fallback to `llms.txt`.

## Actions

1. Sign up in SolvaPay Console.
2. Complete onboarding fields: company name, website URL, country, and currency.
3. Accept terms and continue to first product setup.
4. Confirm organization owner and backup admin access.

## Acceptance Criteria

- [ ] Console access works for your team owner account
- [ ] Onboarding fields are completed (company name, website URL, country, currency)
- [ ] At least two team members can access billing/admin settings

## Notes

- New accounts start in sandbox by default.
- Stripe setup is completed later from dashboard after first product creation.
- Keep team-level ownership access documented before go-live.

## Failure Remediation

- Missing admin access -> add backup admin before continuing to product setup.
- Onboarding form blocked -> validate required company profile fields and retry.
