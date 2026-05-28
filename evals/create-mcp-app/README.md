# create-mcp-app evals

Skill: `solvapay/create-mcp-app` at [../../skills/solvapay/create-mcp-app/](../../skills/solvapay/create-mcp-app/).

Family-wide harness contract: [../README.md](../README.md).

## Scaffolder paths

Eval prompts use:

```text
<skills-repo>/skills/solvapay/create-mcp-app/scripts/describe.mjs
<skills-repo>/skills/solvapay/create-mcp-app/scripts/scaffold.mjs
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
