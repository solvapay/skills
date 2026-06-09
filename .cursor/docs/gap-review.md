# Skills Gap Review

Audit of the SolvaPay skills repo against [agentskills-best-practices.md](./agentskills-best-practices.md) and [agentskills.io](https://agentskills.io/skill-creation/best-practices).

**Date:** 2026-05-29  
**Skills audited:** `solvapay`, `create-mcp-app`, `sdk-integration`, `website-checkout`, `lovable-checkout`

**Validation:** `npm run validate` — all five skills pass.

---

## Summary

Post-remediation (2026-05-29): all five skills aligned to agentskills.io best practices — imperative descriptions, gotchas, multi-step workflows (procedure + checklist + validation loop), handoff templates, plan-validate-execute where applicable, bundled scripts, reference splits, and broken-link fixes.

---

## Instruction pattern scorecard

| Skill | Gotchas | Multi-step | Description | Procedures | Templates | PVE | Scripts |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `solvapay` | ✅ | ✅ | ✅ | ✅ | ✅ | N/A | N/A |
| `create-mcp-app` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `sdk-integration` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `website-checkout` | ✅ | ✅ | ✅ | ✅ | ✅ | — | — |
| `lovable-checkout` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Audit checklist scorecard

| Check | solvapay | create-mcp-app | sdk-integration | website-checkout | lovable-checkout |
| --- | :---: | :---: | :---: | :---: | :---: |
| SKILL.md exists; name matches dir | ✅ | ✅ | ✅ | ✅ | ✅ |
| Frontmatter complete | ✅ | ✅ | ✅ compat | ✅ | ✅ |
| SKILL.md < 500 lines | ✅ | ✅ | ✅ | ✅ | ✅ |
| Imperative description ≤ 1024 | ✅ | ✅ | ✅ | ✅ | ✅ |
| Guardrails near top | ✅ | ✅ | ✅ | ✅ | ✅ |
| Gotchas section | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mandatory read order | N/A | ✅ | ✅ | ✅ | ✅ |
| Task progress checklist | ✅ | ✅ | ✅ | ✅ | ✅ |
| Verification loop | ✅ | ✅ | ✅ | ✅ | ✅ |
| Handoff template | ✅ | ✅ | ✅ | ✅ | ✅ |
| Plan-validate-execute | N/A | ✅ | ✅ | — | ✅ |
| References focused (< ~300) | N/A | ✅ split | ✅ split | ✅ | ✅ split |
| One-level-deep refs from SKILL | ✅ | ✅ | ✅ | ✅ | ✅ |
| Bundled scripts | N/A | ✅ | ✅ | — | ✅ |
| Trigger evals | ✅ | ✅ | ✅ | ✅ | ✅ |
| Output evals | ✅ | ✅ | ✅ | ✅ | ✅ |
| No deprecated vocabulary | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cross-links resolve | ✅ | ✅ GitHub URLs | ✅ | ✅ | ✅ |

---

## Changes made (2026-05-29)

### PR 1 — Broken links and vocabulary

- `lovable-checkout/references/GUIDE.md`: `mcp-app-checkout` → valid skill ids
- `sdk-integration/references/REFERENCE.md`: removed `mcp pay` topic hint
- `create-mcp-app` refs: monorepo-relative links → GitHub URLs

### PR 2 — SKILL.md entry points

- All skills: guardrails → gotchas → mandatory read order → procedure → PVE → verification loop → task progress → handoff template
- Imperative `Use this skill when…` descriptions for all five skills

### PR 3 — References

- `sdk-integration`: split `REFERENCE.md` → `operations.md`, `env-and-init.md`, `mcp-product-console.md`
- `lovable-checkout`: split `GUIDE.md` → `01-edge-and-secrets.md`, `02-provider-and-routes.md`, `03-troubleshooting-and-sandbox.md`
- `website-checkout/react.md`: procedure + Express skeleton
- `sdk-integration/express.md`: implementation checklist
- `website-checkout/nextjs.md`: TOC; flattened out-of-scope chain
- `create-mcp-app/verify.md`: inlined upstream failure remediation
- `create-mcp-app/hosting/cloudflare/README.md`: guardrail dedup

### PR 4 — Scripts

- `create-mcp-app/scripts/validate-selections.mjs`
- `sdk-integration/scripts/check-env.mjs`
- `lovable-checkout/scripts/check-import-map.mjs`

### PR 5 — Router and trigger evals

- Trimmed router intent matrix to top-of-funnel triggers
- Extended disambiguation with Lovable option
- Updated sdk-integration trigger query (intent-based webhook phrasing)

---

## Remaining optional follow-ups

- Add TOCs to all create-mcp-app refs >100 lines (partial — largest files already split previously)
- Run full trigger eval harness (3× per query) in CI executor when available
- Sync `mcp-server-wiring.md` with `sdk-integration/references/mcp-server.md` on MCP wiring changes
