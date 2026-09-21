# create-mcp-app scripts

Thin wrappers around the `create-solvapay` scaffolder scripts. Run from the skill directory:

```bash
node scripts/check-toolchain.mjs --language python
node scripts/scaffold-app.mjs ./my-mcp --language python --tool-name generate_haiku
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
( cd node_modules/create-solvapay/scripts/mcp && npm install )
```

For internal dev-mode testing against `https://api-dev.solvapay.com`, use preview tooling and pass `--dev` to the wrappers:

```bash
npm install create-solvapay@preview
node scripts/describe.mjs --dev path/to/openapi.json
node scripts/scaffold.mjs --dev path/to/openapi.json ./target --selections /tmp/selections.json
npx -y solvapay@preview init --dev
```

The wrappers strip `--dev` before invoking upstream scripts, set `SOLVAPAY_API_BASE_URL=https://api-dev.solvapay.com` for the run, and `scaffold.mjs --dev` writes that value into the generated `.env` after a successful scaffold.

`scaffold-app.mjs` also accepts `--api-base <url>`. That flag does not replace `--dev`: a checkout lane still needs `--dev` (or the gate forces it) for path deps. `--api-base` is forwarded to `create-solvapay` so init and `.env` hit the named origin instead of api-dev.

## Resolution order

Wrappers resolve `create-solvapay/scripts/mcp/` via:

1. `SCAFFOLDER_SCRIPTS_DIR` environment variable
2. Local `create-solvapay` npm package (`npm install create-solvapay`)
3. `SOLVAPAY_SDK_ROOT` (fails loudly when set but not a checkout)
4. Sibling monorepo checkout at `../../../solvapay-sdk/tools/create-solvapay/scripts/mcp`

The skill wrappers have no local runtime dependencies. When resolving through
`SCAFFOLDER_SCRIPTS_DIR` or the sibling monorepo checkout, install that
scaffolder directory's deps once:

```bash
( cd "$SCAFFOLDER_SCRIPTS_DIR" && npm install )
# or: ( cd solvapay-sdk/tools/create-solvapay/scripts/mcp && npm install )
```

### Stable vs preview (`--dev`)

When resolving via the local npm package (option 2), pick the dist-tag that
matches the run:

```bash
# standard (stable) — what end users get
npm install create-solvapay

# --dev / internal testing — pulls the preview build. Use it when the
# skill docs describe a scaffolder feature that is not on @latest yet.
npm install create-solvapay@preview
```

Installing stable (`@latest`) while running `--dev` is the trap that bites:
a preview-only `upstreamAuth.kind` or flag the skill docs mention can fail
deep in `validateSelections` with a confusing "`upstreamAuth.kind` must be
one of …" error. `resolve-scaffolder.mjs` warns when it detects a stable
build under a dev backend, and the wrappers now provide that dev signal
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

- **Published package**: `npm create solvapay@latest <name> -- --type mcp` (TypeScript)
- **SDK source**: `solvapay-sdk/tools/create-solvapay/scripts/mcp/`
- **Contracts**: [../references/from-openapi/describe.md](../references/from-openapi/describe.md), [../references/from-openapi/scaffold.md](../references/from-openapi/scaffold.md)

## Local solvapay-sdk follow-ups (not this repo)

Recorded here so they stay tracked. Do not publish anything for them.

1. Wire pin rewriting into the OpenAPI `scripts/mcp/scaffold.mjs` lane. `failOnNotPublished: true` exists only on the from-scratch path, so OpenAPI still copies `templates/mcp/_base/package.json` and emits the unsatisfiable `@solvapay/server ^1.1.0` tree.
2. `tools/init/src/language/versions.ts` fallbacks point at versions that do not exist on npm (`@solvapay/mcp` 1.0.0, `server` 3.0.0, `react` 3.0.0, `server-wasm` 0.2.0). The registry lane must keep failing loudly via `failOnNotPublished` rather than pinning those fallbacks.
