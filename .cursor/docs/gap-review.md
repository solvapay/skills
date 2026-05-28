# Skills Gap Review

Audit of the SolvaPay skills repo against [agentskills-best-practices.md](./agentskills-best-practices.md) and the [agentskills.io specification](https://agentskills.io/specification).

**Date:** 2026-05-28  
**Skills audited:** `solvapay`, `create-mcp-app`, `sdk-integration`, `website-checkout`, `lovable-checkout`

**Validation:** `npm run validate` — all five skills pass.

---

## Summary

| Priority | Count | Theme |
| --- | ---: | --- |
| **P0** | 2 | Broken routing links; missing referenced `scripts/` |
| **P1** | 10 | Oversized references, missing evals/trigger tests, depth-2+ routing, content gaps |
| **P2** | 4 | Docs hygiene, optional metadata, README drift |

**Recommended PR sequence**

1. Fix P0 broken links and script references (`solvapay` intent matrix + `create-mcp-app` script paths)
2. Split oversized references (`widget-templates.md`, `intent-driven.md`)
3. Add trigger eval query sets per skill; expand output evals beyond `create-mcp-app`
4. Add explicit Gotchas sections to surface skills; README architecture refresh

Feeds into [`align_skills_to_agentskills_spec`](../../solvapay-frontend/.cursor/plans/align_skills_to_agentskills_spec_1ce17c96.plan.md) remediation work.

---

## Structure and spec compliance

### [P0] Router intent matrix links to removed paths

**Skill(s):** solvapay  
**Guide section:** Skill format / File references  
**Finding:** `solvapay/SKILL.md` intent matrix links to paths that no longer exist after the `references/` migration:

- `../create-mcp-app/existing-server/guide.md` → actual: `../create-mcp-app/references/existing-server.md`
- `../sdk-integration/mcp-server/guide.md` → actual: `../sdk-integration/references/mcp-server.md`
- `../sdk-integration/react/guide.md` → actual: `../sdk-integration/references/react.md`

Agents that follow the router will fail to load handoff targets.

**Recommendation:** Update all intent-matrix and negative-routing links to current `references/` paths (or sibling `SKILL.md` + anchor). Add a CI link check or extend `npm run validate`.

**Effort:** S

---

### [P0] `create-mcp-app` references missing `scripts/` directory

**Skill(s):** create-mcp-app  
**Guide section:** Scripts / Progressive disclosure  
**Finding:** `SKILL.md` instructs agents to run `scripts/describe.mjs`, `scripts/scaffold.mjs`, `scripts/verify.mjs`, and links to `scripts/README.md`. No `scripts/` directory exists in the skill install payload. Scripts live in `solvapay-sdk/packages/create-solvapay/scripts/mcp/` (evals hard-code absolute paths to that location).

**Recommendation:** Either (a) vendor thin wrapper scripts + README into `skills/create-mcp-app/scripts/` that delegate to the scaffolder package, or (b) replace path references with explicit `npx`/package paths and document prerequisites in `compatibility`. Option (a) aligns with agentskills.io script bundling.

**Effort:** M

---

### [P1] Oversized reference files

**Skill(s):** create-mcp-app, sdk-integration, lovable-checkout  
**Guide section:** Spending context wisely  
**Finding:** Files exceed the ~300-line focused-reference budget (critical flag > 500):

| File | Lines |
| --- | ---: |
| `create-mcp-app/references/hosting/cloudflare/widget-templates.md` | 628 |
| `create-mcp-app/references/from-openapi/intent-driven.md` | 521 |
| `sdk-integration/references/REFERENCE.md` | 428 |
| `lovable-checkout/references/GUIDE.md` | 394 |

Note: `hosting/cloudflare.md` (~782 lines) was already split into `hosting/cloudflare/` — hypothesis dismissed.

**Recommendation:** Split `widget-templates.md` by template category; split `intent-driven.md` into clustering rules + examples + anti-patterns; consider splitting `REFERENCE.md` by package or concern.

**Effort:** M–L

---

### [P1] Reference depth exceeds one hop from `SKILL.md`

**Skill(s):** create-mcp-app  
**Guide section:** Progressive disclosure / File references  
**Finding:** `references/from-openapi/references/` creates depth-3 chains (`SKILL.md` → `from-openapi/guide.md` → `references/selections-schema.md`). Cross-skill links from references also use `../../../sdk-integration/...` paths.

**Recommendation:** Flatten nested `references/references/` into `references/from-openapi/` (e.g. `selections-schema.md` at sibling level). Keep cross-skill links in `SKILL.md` handoff sections where possible.

**Effort:** M

---

### [P2] `AGENTS.md` symlinks — documented, spec-optional

**Skill(s):** all five  
**Guide section:** Skill format  
**Finding:** Each skill has `AGENTS.md -> SKILL.md`. Spec requires only `SKILL.md`. README documents this as a client compat shim — acceptable. Installed copies outside this repo may drift if not symlinked (local dev concern, not repo defect).

**Recommendation:** No change required in repo. Optionally add a validate step that `AGENTS.md` resolves to identical content as `SKILL.md`.

**Effort:** S

---

## Context and content quality

### [P1] No explicit Gotchas sections

**Skill(s):** all five  
**Guide section:** Instruction patterns — Gotchas  
**Finding:** No `## Gotchas` heading in any `SKILL.md`. Failure-mode knowledge is embedded in guardrails and prose (especially `create-mcp-app`) but not collected as scannable gotchas per agentskills.io guidance.

**Recommendation:** Add a `## Gotchas` section to each surface skill with 3–8 concrete, non-obvious corrections (e.g. `registerPayable` two-arg shape, Petstore relative server URL, Lovable secret placement).

**Effort:** S–M

---

### [P1] `website-checkout` and `lovable-checkout` lack validation loops in SKILL

**Skill(s):** website-checkout, lovable-checkout  
**Guide section:** Validation loops  
**Finding:** `sdk-integration` and `create-mcp-app` include verification/handoff checklists. `website-checkout` has a task checklist but no explicit validate-then-fix loop. `lovable-checkout` is minimal (34 lines) — delegates to `references/GUIDE.md` without a SKILL-level verification loop.

**Recommendation:** Add a short "Verification loop" section to both SKILL files mirroring `sdk-integration` (happy path + failure path in sandbox).

**Effort:** S

---

### [P2] `sdk-integration` missing `compatibility` frontmatter

**Skill(s):** sdk-integration  
**Guide section:** Skill format  
**Finding:** Multi-runtime skill (Next.js, Express, Deno, Supabase Edge, MCP) has no `compatibility` field. `create-mcp-app` and `lovable-checkout` include it.

**Recommendation:** Add `compatibility` listing Node version, optional runtimes, and network requirement for `npx solvapay init`.

**Effort:** S

---

## Descriptions and discovery

### [P1] No trigger eval query sets

**Skill(s):** all five  
**Guide section:** Descriptions and discovery  
**Finding:** No `evals/trigger-queries.json` (or equivalent) for any skill. Only `create-mcp-app` has output evals. Description optimization cannot be regression-tested.

**Recommendation:** Add ~20 labeled trigger queries per skill (train/validation split). Start with `solvapay` router near-miss negatives and `create-mcp-app` vs `sdk-integration` boundary cases.

**Effort:** M

---

### [P1] Router vs surface keyword boundary needs eval verification

**Skill(s):** solvapay, sdk-integration, create-mcp-app  
**Guide section:** Descriptions — Router vs surface  
**Finding:** Router description (400 chars) is appropriately narrow. Surface descriptions are detailed (`sdk-integration` 679 chars, `create-mcp-app` 468 chars) with explicit cross-routing ("Use `create-mcp-app` instead when…"). Keyword overlap risk exists for MCP/paywall phrases — needs trigger evals to confirm, not prose review alone.

**Recommendation:** Build trigger eval set focused on near-misses: "paywall my API" → sdk-integration; "scaffold mcp" → create-mcp-app; "add solvapay" → solvapay router.

**Effort:** M

---

## Scripts and evals

### [P1] Output eval coverage limited to `create-mcp-app`

**Skill(s):** sdk-integration, website-checkout, lovable-checkout, solvapay  
**Guide section:** Eval-driven iteration  
**Finding:** Only `create-mcp-app/evals/evals.json` exists (5+ output eval cases with expectations). Other four skills have no output evals.

**Recommendation:** Add 2–3 eval cases per surface skill (e.g. sdk-integration: Next.js paywall wiring; website-checkout: checkout session route; lovable-checkout: edge function secret handling).

**Effort:** M

---

### [P1] Eval fixtures use hard-coded absolute paths

**Skill(s):** create-mcp-app  
**Guide section:** Eval-driven iteration  
**Finding:** `evals/evals.json` prompts reference `/Users/tommy/projects/solvapay/solvapay-sdk/...` and `/Users/tommy/.claude/skills/...` — not portable across machines or CI.

**Recommendation:** Parameterize script paths via env var or relative path from skill root; document in `evals/README.md`.

**Effort:** S

---

### [P2] Eval workspace not repo-level

**Skill(s):** create-mcp-app  
**Guide section:** Eval workspace layout  
**Finding:** `evals/` lives inside the skill (fine for `evals.json` per spec). No `create-mcp-app-workspace/` for iteration artifacts — acceptable for current maturity; flag for when eval automation lands.

**Recommendation:** Create repo-level `eval-workspaces/` gitignored directory when running automated eval loops.

**Effort:** S

---

## Cross-skill integrity

### [P1] README architecture diagram is stale

**Skill(s):** repo root  
**Guide section:** Directory structure  
**Finding:** `README.md` architecture block shows pre-migration layout (`guide.md`, `tool-design.md` at skill root; `nextjs/01-setup.md` under website-checkout). Actual layout uses `references/` throughout.

**Recommendation:** Update architecture diagram to match current tree (out of scope for skill content edits unless requested — track here for follow-up).

**Effort:** S

---

### [P2] Five-skill install story documented

**Skill(s):** repo root  
**Guide section:** Cross-skill integrity  
**Finding:** README documents `npx skills add solvapay/skills --all -y` and warns about router-only install. **Confirmed OK.**

**Recommendation:** None.

**Effort:** —

---

## Audit checklist scorecard

| Check | solvapay | create-mcp-app | sdk-integration | website-checkout | lovable-checkout |
| --- | :---: | :---: | :---: | :---: | :---: |
| SKILL.md exists; name matches dir | ✅ | ✅ | ✅ | ✅ | ✅ |
| Frontmatter complete | ✅ | ✅ | ⚠️ no compat | ✅ | ✅ |
| SKILL.md < 500 lines | ✅ 99 | ✅ 189 | ✅ 158 | ✅ 63 | ✅ 34 |
| Standard `references/` layout | ✅ | ✅ | ✅ | ✅ | ✅ |
| References focused (< ~300) | ✅ | ❌ | ❌ | ✅ | ❌ |
| One-level-deep refs from SKILL | ✅ | ⚠️ | ✅ | ✅ | ✅ |
| validate passes | ✅ | ✅ | ✅ | ✅ | ✅ |
| Gotchas section | ❌ | ❌ | ❌ | ❌ | ❌ |
| Guardrails explicit | ✅ | ✅ | ✅ | ✅ | ✅ |
| Checklists | ✅ | ✅ | ✅ | ✅ | ⚠️ minimal |
| Validation loop | ⚠️ | ✅ | ✅ | ❌ | ❌ |
| Mandatory read order | N/A | ✅ | ⚠️ | ❌ | ⚠️ |
| Description ≤ 1024 | ✅ 400 | ✅ 468 | ✅ 679 | ✅ 534 | ✅ 558 |
| Trigger evals | ❌ | ❌ | ❌ | ❌ | ❌ |
| Bundled scripts | N/A | ❌ | N/A | N/A | N/A |
| Output evals | ❌ | ✅ | ❌ | ❌ | ❌ |
| Cross-links resolve | ❌ | ⚠️ | ✅ | ✅ | ✅ |

---

## Finding count by priority

| Priority | Count |
| --- | ---: |
| P0 | 2 |
| P1 | 10 |
| P2 | 4 |
| **Total** | **16** |
