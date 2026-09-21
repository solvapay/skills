# create-mcp-app evals

Skill: `solvapay/create-mcp-app` at [../../skills/create-mcp-app/](../../skills/create-mcp-app/).

Family-wide harness contract: [../README.md](../README.md).

## Scaffolder paths

Eval prompts use:

```text
<skills-repo>/skills/create-mcp-app/scripts/describe.mjs
<skills-repo>/skills/create-mcp-app/scripts/scaffold.mjs
```

Set `SCAFFOLDER_SCRIPTS_DIR` to `create-solvapay/scripts/mcp` or install `create-solvapay` locally if resolution fails.

Fixtures: copy from `<skills-repo>/evals/create-mcp-app/fixtures/petstore-mcp/` per eval setup blocks.

## Dev-mode contract

Harness sets `EVAL_DEV_MODE=1` to append `dev_mode_suffix` from `evals.json` to each prompt (verbatim). When inactive, send `prompt` as-is.

`--dev` seeds `SOLVAPAY_API_BASE_URL=https://api-dev.solvapay.com` into `.env`:

| Entry point | Flag |
| --- | --- |
| `npm create solvapay@latest ... --type mcp --dev` | `--dev` |
| `npx solvapay@latest init --dev` | `--dev` |
| `node scripts/scaffold.mjs ... --dev` | `--dev` |

Internal testing only — production keys are rejected by api-dev.

Per-eval `assertions_dev` for dev codepath verification is deferred; current assertions are dev/prod-agnostic.

## Runner contract (`requires` / `params`)

Import `selectEvals` from [`../lib/select-evals.mjs`](../lib/select-evals.mjs). Skip any eval whose `requires` env vars are unset — do not fail the suite.

Evals 14–17 require `EVAL_REQUIRES_SDK_CHECKOUT`. They assert blocked-gate behavior (`registry-404 no-checkout`): isolate the workspace from a sibling checkout / `SOLVAPAY_SDK_ROOT` so the gate actually prints that line. The env var opts the harness into that isolated run; it does not mean the agent should see a checkout.

Eval 11 is parametrized over `bearer` / `apiKey` / `oauth2-client-credentials`. Eval 9 (`apiKey-multi`) remains the multi-header discriminator against the `apiKey` row.

## Local SDK follow-ups

See [../../skills/create-mcp-app/scripts/README.md](../../skills/create-mcp-app/scripts/README.md#local-solvapay-sdk-follow-ups-not-this-repo). Nothing in this skill publishes packages.
