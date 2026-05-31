# create-mcp-app scripts

Thin wrappers around the `create-solvapay` scaffolder scripts. Run from the skill directory:

```bash
node scripts/describe.mjs path/to/openapi.json
node scripts/scaffold.mjs path/to/openapi.json ./target --selections /tmp/selections.json
node scripts/validate-selections.mjs /tmp/selections.json
```

All skill scripts support `--help`. Upstream scaffolder scripts (`describe.mjs`, `scaffold.mjs`) also support `--help` when resolved.

## Resolution order

Wrappers resolve `create-solvapay/scripts/mcp/` via:

1. `SCAFFOLDER_SCRIPTS_DIR` environment variable
2. Local `create-solvapay` npm package (`npm install create-solvapay`)
3. Sibling monorepo checkout at `../../../solvapay-sdk/packages/create-solvapay/scripts/mcp`

On first use against a fresh checkout, install scaffolder deps once:

```bash
( cd "$SCAFFOLDER_SCRIPTS_DIR" && npm install )
# or: ( cd solvapay-sdk/packages/create-solvapay/scripts/mcp && npm install )
```

## Project-local scripts

After scaffolding (`npm create solvapay@latest -- --type mcp`), these live in the **generated project**:

```bash
node scripts/verify.mjs http://localhost:8787
node scripts/test.mjs https://my-worker.example.com --spec path/to/openapi.json
```

`verify.mjs` and `test.mjs` are not in this skill directory — they ship inside the scaffolded worker.

## Source of truth

- **Published package**: `npm create solvapay@latest <name> -- --type mcp`
- **SDK source**: `solvapay-sdk/packages/create-solvapay/scripts/mcp/`
- **Contracts**: [../references/from-openapi/describe.md](../references/from-openapi/describe.md), [../references/from-openapi/scaffold.md](../references/from-openapi/scaffold.md)
