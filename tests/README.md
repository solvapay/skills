# Local-stack MCP skill harness

End-to-end gate for `create-mcp-app` across TypeScript, Python, Ruby, Go, and Rust. One implementation, five surface rows. Needs a **live** local platform stack — it does not start servers for you.

## Prerequisites

- Local stack: `(cd ../platform && ./scripts/dev.sh start)`
- Sandbox secret key + a **real** product from the provider console at `http://localhost:3010`. The product ref must resolve on that stack (`GET /v1/sdk/products/:ref`). `prd_…_harness_placeholder` and `__SOLVAPAY_PRODUCT_REF__` are invalid.
- `solvapay-sdk` checkout with the three CLI packages built and not stale vs their `src/` trees:

  ```
  pnpm --filter create-solvapay --filter solvapay --filter @solvapay/init build
  ```

- Language toolchain for the lanes you run (`npm`, `uv`, `bundle`, `go`, `cargo`)

## Env

Required — no defaults. Put them in the environment or gitignored `tests/.env.local`:

```
SOLVAPAY_API_BASE_URL=http://localhost:3010
SOLVAPAY_SECRET_KEY=sk_sandbox_...
SOLVAPAY_PRODUCT_REF=prd_...
SOLVAPAY_SDK_ROOT=/absolute/path/to/solvapay-sdk
```

`SOLVAPAY_PRODUCT_REF` must be a product that exists for `SOLVAPAY_SECRET_KEY` on `SOLVAPAY_API_BASE_URL`. Do not commit a real product into the repo — update gitignored `tests/.env.local`.

Optional: `MCP_TEST_CREDENTIALS_FILE` with `{ "accessToken": "…" }` to run the paywall-gate case. Without it that case is `skipped`, never `passed`.

SDK traffic must use `:3010` (provider-app proxy). Never `:3001`.

## Run

```bash
npm run test:e2e -- --lang python
npm run test:e2e:all
node tests/run.mjs --lang ts --keep --verbose
node tests/run.mjs --lang ts --probe-waivers --keep --verbose
```

`--lang` selects any lane. No lane is the privileged fast path. Python and Rust are multi-minute on a cold checkout.

Default output is one summary line per lane. Logs land in `tests/workspaces/<id>/` and are printed on failure (or always with `--verbose`). `--json` emits the machine-readable summary, including a top-level `waivers` array of every `xfail` this run reported.

## Statuses

| Status | Meaning | Default exit |
| --- | --- | --- |
| `pass` | Case succeeded on an unpatched tree (or a tree whose waivers do not target this case) | 0 |
| `xfail` | Case is covered by a declared waiver. The tree was patched for that case. Never reported as `pass` | 0 |
| `skip` | Case could not run (missing customer token, no paid tool) | 0 |
| `FAIL` | Unexpected failure, stale waiver, unknown breakage, or ineffective waiver | 1 |

`--strict` exits non-zero on any `xfail` or `skipped` result. Use it on a release branch when the waiver set must be empty.

## Waivers

A lane must not report `pass` for an artifact the harness edited. Test-only edits live in `SURFACES[].waivers` (`tests/lib/surfaces.mjs`), not as silent `scaffoldPatches`.

Each waiver names the case it expects to fail (`provesAt`), the error it expects (`failureMatch`), and how it expires. `versionProbe` / `observedAgainst` hint when a newer package version landed. `registryProbe` (HTTP 404 vs 2xx) and `exportProbe` (package `exports` map) run on **every** lane — not only `--probe-waivers` — and fail the case the moment the claimed gap is gone. The runner applies only the waivers for the case about to run.

With `--probe-waivers` (off by default so local iteration stays fast):

1. Run the case unpatched.
2. If it **passes**, the waiver is stale — fail and delete it.
3. If it **fails** with a message that does not match `failureMatch`, fail: something else broke behind the waiver.
4. If it **fails** and matches, apply the waiver and re-run. Success is `xfail`. A second failure means the waiver does not fix its own claim.

Without `--probe-waivers`, waived cases still apply the edit and report `xfail (unprobed)`. They never show as `pass`.

Waivers expire by observed behavior, not by date. `registryProbe` and `exportProbe` delete themselves by failing the lane as soon as the package publishes or the export appears. When only a `versionProbe` is present and the probed version is greater than `observedAgainst`, the lane footer hints that the waiver may be stale; `--probe-waivers` is what actually deletes that kind.

Server-scope waivers (for example Python `http_serve.py` at `mcp-handshake`) restart the process between the unpatched probe and the patched re-check.
