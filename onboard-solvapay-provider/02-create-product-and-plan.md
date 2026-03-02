# Step 2: Create Product and Plan

Define the monetized surface area and pricing configuration.

## Docs References (Topic-Based)

- Topics: `create product`, `plans`, `pricing`, `checkout`.
- Retrieval hint: resolve onboarding and API domain pages by topic via MCP/`llms.txt`.

## Actions

1. Create a product in Solvapay console.
2. Create at least one plan for that product.
3. Confirm product and plan references used by integration code.
4. Decide hosted checkout default vs embedded flow requirements.
5. Document entitlement behavior for each plan (what unlocks, limits, period).

## Acceptance Criteria

- [ ] Product exists and is active
- [ ] Plan is attached to product
- [ ] Integration references match dashboard references exactly
- [ ] Billing interval and limits match intended pricing model
- [ ] Entitlement rules are documented for engineering and support

## Guardrails

- Never hardcode temporary refs in production code.
- Never launch without at least one tested paid plan.

## Failure Remediation

- Mismatched refs in code/config -> pause rollout and re-sync all env/config references.
- Conflicting plan semantics -> update product/plan definition before sandbox tests.
