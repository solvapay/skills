# Dependency gate

One procedure for every language. The language row supplies the registry URL and the checkout; this file does not branch. A present, valid `solvapay-sdk` checkout takes precedence over the registry — when one is available the gate prints `ok checkout` and you scaffold with `--dev`, even if the registry is also reachable.

Read this after you pick a language. Do not scaffold until the gate passes.

## Probe

Run:

```bash
node scripts/check-toolchain.mjs --language <id>
```

It prints one line and nothing else:

```
<id> ok registry
<id> ok checkout
<id> fail missing-bin <bin> (<install url>)
<id> fail missing-ruby-headers ruby-dev (Debian/Ubuntu) or ruby-devel (Fedora/RHEL)
<id> fail registry-404 no-checkout
```

`ok checkout` — a valid `solvapay-sdk` checkout is available (a sibling of this skills repo, or `SOLVAPAY_SDK_ROOT`). The checkout wins the lane; scaffold with `--dev` so manifests rewrite to path deps. The registry is not consulted — this is the local-only lane, and it is chosen whenever a checkout is present.

`ok registry` — no checkout is available and that language's registry is reachable. SolvaPay packages install from the registry; scaffold without `--dev`.

Any `fail` line is a stop. Install the named binary, or clone `solvapay-sdk` and set `SOLVAPAY_SDK_ROOT`. Never invent a stub package or pin a guessed version.

`SOLVAPAY_SDK_ROOT` set to a path that is not a checkout is a loud error — there is no fallback.

## Scaffold after a pass

```bash
node scripts/scaffold-app.mjs <target-dir> --language <id> --tool-name <name>
```

`--dev` is required when the gate printed `ok checkout` — it rewrites manifests to checkout path deps. It does **not** lock the API origin: pass `--api-base <url>` to point auth, product lookup, and `.env` at a local stack (for example `http://localhost:3010`) while keeping `--dev` for path deps. `scaffold-app.mjs` refuses to run when the gate fails. `--language ts` uses this same script and the same gate.

## Install warning

`create-solvapay` treats a failed install as a soft warning (`⚠️ … failed`). That is not success. If the scaffolder prints `⚠️`, stop and fix the install. Do not claim dependencies are installed.

## Failure signatures

| Line | Meaning | Fix |
| --- | --- | --- |
| `fail missing-bin` | Required CLI is not on `PATH` | Install from the URL in the line |
| `fail missing-ruby-headers` | Ruby is on `PATH` but `rubyhdrdir` is absent — native gems cannot compile | Install `ruby-dev` / `ruby-devel` (see [ruby.md](ruby.md)) |
| `fail registry-404 no-checkout` | Package is unpublished and no SDK checkout | Clone `solvapay-sdk`, set `SOLVAPAY_SDK_ROOT`, retry |
| `… is not published to the registry: <pkg>` (scaffolder, non-`--dev`) | The package name resolves but the needed version is unpublished (e.g. `@solvapay/server-wasm`); the registry lane can't produce an installable manifest | Scaffold with `--dev` against a checkout — a 404 no longer silently pins an uninstallable fallback |
| `SOLVAPAY_SDK_ROOT=… is not a solvapay-sdk checkout` | Override is set but invalid | Point it at the repo that contains `contract/manifest/repo-paths.yaml` |
| scaffolder `⚠️` | Install ran and failed | Read the warning; do not continue |
