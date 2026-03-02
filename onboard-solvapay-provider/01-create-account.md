# Step 1: Create Account

Create provider account and complete payment account connection.

## Docs References (Topic-Based)

- Topics: `create account`, `payments settings`, `branding/pages`.
- Retrieval hint: resolve topics via MCP first, fallback to `llms.txt`.

## Actions

1. Sign up in Solvapay console.
2. Open `Settings -> Payments` and connect Stripe.
3. Complete Stripe verification requirements.
4. Open `Settings -> Pages` and set brand basics (name, colors, logo).
5. Confirm organization owner and backup admin access.

## Acceptance Criteria

- [ ] Console access works for your team owner account
- [ ] Stripe connection shows connected/verified status
- [ ] Branding appears on hosted pages
- [ ] At least two team members can access billing/admin settings

## Notes

- New accounts start in sandbox by default.
- Keep team-level ownership access documented before go-live.

## Failure Remediation

- Stripe onboarding blocked -> complete missing KYC details in Stripe dashboard.
- Missing admin access -> add backup admin before continuing to product setup.
