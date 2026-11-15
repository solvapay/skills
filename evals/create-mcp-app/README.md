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

Fixtures: copy per eval setup blocks.

| Fixture | Language | Used by |
| --- | --- | --- |
| `fixtures/petstore-mcp/` | TypeScript, scaffolded Workers project | extend / existing-server / deploy cases |
| `fixtures/research-mcp-python/` | Python, an MCP SDK 2.x `MCPServer` with no paywall | `python-existing-server-paywall` |
| `fixtures/quotes-mcp-go/` | Go, a `solvapay.NewMCPServer` project never deployed | `go-container-deploy` |

The Python and Go scaffold cases (`python-from-scratch`, `go-from-scratch`) need a `create-solvapay` whose `--help` lists `--language`, plus Python >= 3.10 with uv or Go >= 1.26 on the runner.

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
