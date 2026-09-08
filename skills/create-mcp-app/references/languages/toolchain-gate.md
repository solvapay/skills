# Dependency gate

One procedure for every language. The language row supplies the registry URL and the checkout fallback; this file does not branch.

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
<id> fail registry-404 no-checkout
```

`ok registry` — SolvaPay packages install from that language's registry. Scaffold without `--dev`.

`ok checkout` — the registry 404'd (or timed out) and a `solvapay-sdk` checkout is available. Scaffold with `--dev` so manifests rewrite to path deps. Set `SOLVAPAY_SDK_ROOT` to the checkout if it is not a sibling of this skills repo.

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
| `fail registry-404 no-checkout` | Package is unpublished and no SDK checkout | Clone `solvapay-sdk`, set `SOLVAPAY_SDK_ROOT`, retry |
| `SOLVAPAY_SDK_ROOT=… is not a solvapay-sdk checkout` | Override is set but invalid | Point it at the repo that contains `contract/manifest/repo-paths.yaml` |
| scaffolder `⚠️` | Install ran and failed | Read the warning; do not continue |
