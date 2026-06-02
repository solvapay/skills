# SolvaPay create-mcp-app Improvement Spec

Prioritized improvement spec for the `create-mcp-app` skill plus the `solvapay init` / `create-solvapay` CLI behaviors it invokes. This document is a spec for a follow-up implementation pass — no skill code is changed by writing it.

## Context

Built `layr-mcp5-cursor` from `https://api.leyr.io/openapi.json` via the **agent path** (`scripts/describe.mjs` + `scripts/scaffold.mjs`), in **intent-driven** mode, with `upstreamAuth.kind: apiKey-multi` (Leyr's `x-leyr-client-id` + `x-leyr-client-secret`), in **dev mode** (`--dev` / `https://api-dev.solvapay.com`). The worker deployed successfully to `https://layr-mcp5-cursor.petstore-new.workers.dev` and passed `verify.mjs`'s MCP-contract checks.

Along the way the flow hit 8 distinct friction points. 3 of them (F1, F2, F3) left the deliverable functionally incomplete or silently wrong; the rest cost setup time and agent budget or weakened robustness.

Each finding below lists: symptom, evidence, proposed fix, and **owner** (one of `skill-doc`, `skill-script`, `CLI-dependency`).

## Findings

### P0 — leaves the build functionally incomplete

#### F1. Intent-driven metering plan is never created
- **Owner:** skill-doc (+ optional skill-script)
- **Symptom:** The user asked for "each confirmed booking metered," but after the full flow no usage-based metering plan/product was actually wired. Paid tools (`book_appointment`, `manage_booking`) shipped and gate correctly, but there is no metering plan backing them.
- **Evidence:** In intent-driven mode, `plans[]` in `selections.json` is document-only — per [references/from-openapi/selections-schema.md](references/from-openapi/selections-schema.md), `scaffold.mjs` validates the `plans[]` shape but does **not** POST plans to SolvaPay. The flow then relied on `solvapay init` to attach a product, which it did — but to an unrelated one (see F2). Nothing in the happy path creates or verifies the usage-based plan the user requested.
- **Proposed fix:**
  - In [references/solvapay-init.md](references/solvapay-init.md) and the deploy hand-off ([references/from-openapi/deploy.md](references/from-openapi/deploy.md)), add an explicit gate: **create or verify a usage-based metering plan** (via Console or the SDK) before declaring success.
  - Have the skill state plainly that, in intent-driven mode, an authored `plans[]` is **not applied** by scaffold — so the agent must create the plan out-of-band.
  - Optional skill-script: let `scaffold.mjs` (or a small post-scaffold helper) POST the `plans[]` it already validates, behind an explicit flag, so the document-only behavior becomes opt-in actionable.

#### F2. Non-TTY `init --yes` silently auto-picks a smoke/test product
- **Owner:** CLI-dependency (+ skill-doc)
- **Symptom:** `solvapay init` auto-selected a product unrelated to the project, with no prompt and only a single log line.
- **Evidence:** `npx -y solvapay@preview init --dev --yes` logged `Auto-selected product: Credit Grant Smoke 1780059772951 (prd_LWAN39P9)` and wrote `SOLVAPAY_PRODUCT_REF=prd_LWAN39P9` to `.env`. A "Credit Grant Smoke" product has nothing to do with booking metering; for an autonomous agent run this is a silent correctness trap.
- **Proposed fix:**
  - CLI: under `--yes` / non-TTY, prefer an explicit `SOLVAPAY_PRODUCT_REF` if present; if absent, either fail loudly or pick the newest **non-smoke / non-test** product, and log the choice prominently (not a single quiet line).
  - skill-doc: require the agent to read back and confirm the resolved `SOLVAPAY_PRODUCT_REF` after init, and to pass an explicit product ref when one is known.

#### F3. Agent-path dev mode never seeds `SOLVAPAY_API_BASE_URL`
- **Owner:** skill-script or skill-doc
- **Symptom:** After `scaffold.mjs`, the project `.env` had no dev backend URL; the worker would have targeted production until manually corrected.
- **Evidence:** `scaffold.mjs` (agent path) has no `--dev` flag. The dev URL is only seeded by `npm create solvapay … --dev` or by `solvapay init --dev` — but the agent path skips `npm create`, and between scaffold and init the config is incomplete. This session worked around it by hand-editing `.env` to add `SOLVAPAY_API_BASE_URL=https://api-dev.solvapay.com`. The agent-path dev instructions do not mention this manual step.
- **Proposed fix:**
  - skill-script: add `--dev` to the `scaffold.mjs` wrapper so it seeds `SOLVAPAY_API_BASE_URL=https://api-dev.solvapay.com` into `.env` (parity with the published CLI), **or**
  - skill-doc: document the manual `.env` add explicitly in the agent-path dev callout in [AGENTS.md](AGENTS.md) and [references/from-openapi/guide.md](references/from-openapi/guide.md).

### P1 — setup friction / wasted agent budget

#### F4. Stable-vs-preview guard is ineffective on the agent path
- **Owner:** skill-script
- **Symptom:** The guard meant to catch "stable build under a dev backend" never fires during the agent scaffold, so the `apiKey-multi` failure mode is only avoided by the agent proactively installing `@preview`.
- **Evidence:** `warnIfStableUnderDev()` in [scripts/lib/resolve-scaffolder.mjs](scripts/lib/resolve-scaffolder.mjs) reads `process.env.SOLVAPAY_API_BASE_URL`, which is never set in the shell during scaffold — the dev URL lives in `.env`, not the process env:

```17:20:scripts/lib/resolve-scaffolder.mjs
function warnIfStableUnderDev(mcpDir) {
  const apiBase = process.env.SOLVAPAY_API_BASE_URL ?? ''
  const devSignal = /api-dev\.solvapay\.com/.test(apiBase)
  if (!devSignal) return
```

- **Proposed fix:** drive the dev signal from a `--dev` flag or a `selections.json` field (not just `process.env`); have the `describe.mjs` / `scaffold.mjs` wrappers accept `--dev`, and check the installed `create-solvapay` dist-tag so a stable build under dev fails (or warns) early instead of deep inside `validateSelections`.

#### F5. Two consecutive install failures before the flow can start
- **Owner:** skill-doc (+ optional skill-script)
- **Status:** Resolved by keeping the skill wrappers dependency-free and documenting
  `create-solvapay` as an explicit resolver install only.
- **Symptom:** The first `describe.mjs` invocation failed twice in a row on missing dependencies before any real work could begin.
- **Evidence:**
  1. `node scripts/describe.mjs …` → `Error: Could not find create-solvapay scaffolder scripts (describe.mjs / scaffold.mjs).` Required `npm install create-solvapay@preview` in the skill root.
  2. Re-run → ``Error: `@apidevtools/swagger-parser` is not installed.`` Required `npm install` inside `scripts/`.
  These are mentioned as scattered "one-time setup" notes in [references/from-openapi/describe.md](references/from-openapi/describe.md) and [scripts/README.md](scripts/README.md), but the main flow does not front-load them, so an agent hits two failures first.
- **Fix:** the wrappers no longer declare or require local dependencies. Agents either set
  `SCAFFOLDER_SCRIPTS_DIR`, rely on a sibling `solvapay-sdk` checkout, or explicitly
  install `create-solvapay` / `create-solvapay@preview` in the skill directory.

#### F6. `solvapay init` spinner floods agent context
- **Owner:** CLI-dependency (+ skill-doc)
- **Symptom:** The init auth-wait emitted an enormous, unreadable spinner stream and ran for minutes.
- **Evidence:** `npx -y solvapay@preview init --dev --yes` ran ~262s and emitted ~90k characters of `Waiting for authentication... | / - \` spinner frames into the captured output — large token/cost waste for agents and effectively unreadable logs.
- **Proposed fix:**
  - CLI: detect non-TTY (`!process.stdout.isTTY`) and suppress the animated spinner — print a single status line and poll quietly, or expose a `--no-spinner` / quiet flag.
  - skill-doc: tell agents to **background** the init step rather than streaming it, and flag that it requires a human browser click (so it is expected to block on human action, not hang).

### P2 — spec-handling robustness

#### F7. Empty `servers: []` is not surfaced to the agent
- **Owner:** skill-script (+ skill-doc)
- **Symptom:** A spec that declares no servers passes through `describe.mjs` without a clear "you must supply a base URL" signal.
- **Evidence:** The Leyr spec has `servers: []`; `describe.mjs` reported `serverProbe: { status: "skipped", reason: "spec declares no servers (or host/basePath for Swagger 2.0)" }`. One-to-one scaffold derives `apiBaseUrl` from `servers[0].url`, which would break here. This session hardcoded `LEYR_API_BASE = 'https://api.leyr.io'` in `src/lib/leyr.ts` for the intent-driven tools — fine for intent-driven, but a latent failure for one-to-one.
- **Proposed fix:** `describe.mjs` should emit an **advisory** when `servers` is empty or relative, and the guide ([references/from-openapi/describe.md](references/from-openapi/describe.md)) should require the agent to collect/confirm the upstream base URL before scaffolding (especially in one-to-one mode).

#### F8. Malformed upstream path slips through silently
- **Owner:** skill-script
- **Symptom:** A spec path with an obvious typo is wrapped into a tool that would call a 404 URL.
- **Evidence:** Operation `fhir-fhir_get_appointment` maps to `/apifhir/emrs/{emr}/care-units/{care_unit_id}/appointments/{appointment_id}` — note `/apifhir` (missing slash) where every sibling path uses `/api/fhir`.
- **Proposed fix:** `describe.mjs` advisory for paths that break the otherwise-consistent prefix of the spec (e.g. an outlier that does not share the common `/api/...` root), so the agent can skip or correct them.

## Non-issues (worked as designed)

- **`apiKey-multi`** was already a documented Leyr example in [references/from-openapi/selections-schema.md](references/from-openapi/selections-schema.md); detection, validation, and the single `UPSTREAM_API_HEADERS` `.env` seeding all worked.
- **`tool-design.md` contract** — the `registerPayable(name, config)` two-argument shape and `c.respond(data, { text })` response-mode rules were clear and correct; gating to read it before authoring tools worked.
- **`verify.mjs`** passed the MCP-contract checks (`oauthProtectedResource`, `oauthAuthorizationServer`, `toolsList`). The `paywallGate` and `merchantBootstrap` checks **skip** without a human-OAuth credentials file — a known, documented limitation, but worth a one-line note in the deploy/verify docs that agents cannot self-verify the paid path end-to-end.

## Suggested implementation order

1. **F1** — wire/verify the metering plan (the headline functional gap; the product's stated purpose).
2. **F3** — seed `SOLVAPAY_API_BASE_URL` on the agent path (correctness for every dev run).
3. **F4** — make the stable-vs-preview guard actually fire on the agent path (prevents the most confusing failure).
4. **F2**, **F5**, **F6** — init product-pick safety, single bootstrap step, spinner suppression (agent ergonomics / budget).
5. **F7**, **F8** — `describe.mjs` advisories for empty `servers` and malformed paths (robustness).
