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

For internal dev-mode testing against `https://api-dev.solvapay.com`, use preview tooling and pass `--dev` to the wrappers:

```bash
npm install create-solvapay@preview
node scripts/describe.mjs --dev path/to/openapi.json
node scripts/scaffold.mjs --dev path/to/openapi.json ./target --selections /tmp/selections.json
npx -y solvapay@preview init --dev
```

The wrappers strip `--dev` before invoking upstream scripts, set `SOLVAPAY_API_BASE_URL=https://api-dev.solvapay.com` for the run, and `scaffold.mjs --dev` writes that value into the generated `.env` after a successful scaffold.

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

### Stable vs preview (`--dev`)

When resolving via the local npm package (option 2), pick the dist-tag that
matches the run:

```bash
# standard (stable) — what end users get
npm install create-solvapay

# --dev / internal testing — pulls the preview build, which carries
# preview-only features the skill docs describe (e.g. apiKey-multi).
npm install create-solvapay@preview
```

Installing stable (`@latest`) while running `--dev` is the trap that bites:
`scaffold.mjs` rejects preview-only `upstreamAuth.kind` values (such as
`apiKey-multi`) with ``upstreamAuth.kind` must be one of none, bearer, apiKey,
oauth2-client-credentials``. `resolve-scaffolder.mjs` warns when it detects a
stable build under a dev backend, and the wrappers now provide that dev signal
when `--dev` is passed. Pinning `@preview` at install time avoids the mismatch
entirely.

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
