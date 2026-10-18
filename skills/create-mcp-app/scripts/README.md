# create-mcp-app scripts

Thin wrappers around the `create-solvapay` scaffolder scripts. Run from the skill directory:

```bash
node scripts/describe.mjs path/to/openapi.json
node scripts/scaffold.mjs path/to/openapi.json ./target --selections /tmp/selections.json
node scripts/validate-selections.mjs /tmp/selections.json
```

All skill scripts support `--help`. Upstream scaffolder scripts (`describe.mjs`, `scaffold.mjs`) also support `--help` when resolved.

## Agent bootstrap

Run this once in the skill directory before the OpenAPI flow if you are not
using `SCAFFOLDER_SCRIPTS_DIR` or a sibling `solvapay-sdk` checkout:

```bash
npm install create-solvapay
```

## Resolution order

Wrappers resolve `create-solvapay/scripts/mcp/` via:

1. `SCAFFOLDER_SCRIPTS_DIR` environment variable
2. Local `create-solvapay` npm package (`npm install create-solvapay`)
3. Sibling monorepo checkout at `../../../solvapay-sdk/packages/create-solvapay/scripts/mcp`

The skill wrappers have no local runtime dependencies. When resolving through
`SCAFFOLDER_SCRIPTS_DIR` or the sibling monorepo checkout, install that
scaffolder directory's deps once:

```bash
( cd "$SCAFFOLDER_SCRIPTS_DIR" && npm install )
# or: ( cd solvapay-sdk/packages/create-solvapay/scripts/mcp && npm install )
```

### Stable build only

When resolving via the local npm package (option 2), install the stable build
(`npm install create-solvapay`). `resolve-scaffolder.mjs` warns if it finds a
`-preview` scaffolder on the production path; reinstall with
`npm install create-solvapay@latest` and remove any stale
`scripts/node_modules/create-solvapay` in the skill directory, because
resolution can pick it ahead of `@latest`.

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
