# SolvaPay skills — eval harness contract

Eval specs live at the repo root under `evals/<skill>/` (not inside installed skill payloads) so harness metadata never loads when an agent activates a skill. The executor lives outside this repo; these files are the versioned contract.

Guides: [optimizing descriptions](https://agentskills.io/skill-creation/optimizing-descriptions), [evaluating skill output quality](https://agentskills.io/skill-creation/evaluating-skills).

## Skill id mapping

| Eval directory | Installed skill id | Skill path |
| --- | --- | --- |
| `evals/solvapay/` | `solvapay` | `skills/solvapay/SKILL.md` |
| `evals/create-mcp-app/` | `solvapay/create-mcp-app` | `skills/solvapay/create-mcp-app/` |
| `evals/sdk-integration/` | `solvapay/sdk-integration` | `skills/solvapay/sdk-integration/` |
| `evals/website-checkout/` | `solvapay/website-checkout` | `skills/solvapay/website-checkout/` |
| `evals/lovable-checkout/` | `solvapay/lovable-checkout` | `skills/solvapay/lovable-checkout/` |

## Files per skill

| File | Purpose |
| --- | --- |
| `trigger-queries.json` | Description trigger regression — labeled user prompts |
| `evals.json` | Output quality — prompts, expected outcomes, assertions |
| `fixtures/` | Optional stable inputs (create-mcp-app only today) |

## Trigger evals (`trigger-queries.json`)

**Goal:** Does the agent load this skill's `SKILL.md` (or invoke the Skill tool with the matching id) for the prompt?

**Constraints per file:**

- **8–10** queries with `should_trigger: true`
- **8–10** with `should_trigger: false` (same count as true — balanced 8+8, 9+9, or 10+10)
- `split`: `train` (~60% of total) or `validation` (~40%); both polarities in each split
- Run each query **3 times**; pass if trigger rate ≥ 0.5 (should trigger) or &lt; 0.5 (should not)

**Labeling:** Judge against the skill under test, using the router intent matrix in `skills/solvapay/SKILL.md` and each surface skill's `description`. Near-miss negatives share SolvaPay/MCP/checkout vocabulary but need a sibling skill.

### Routing boundaries (edge cases)

| Intent | Triggers | Does not trigger (examples) |
| --- | --- | --- |
| Ambiguous onboarding | `solvapay` router | Any surface with clear stack + task |
| Greenfield paid MCP (OpenAPI, scratch, `npm create solvapay --type mcp`) | `solvapay/create-mcp-app` | `sdk-integration`, checkout skills |
| Existing MCP, SDK wiring only (`createSolvaPayMcpFetch`, no scaffold) | `solvapay/sdk-integration` | `create-mcp-app` unless prompt asks audit + worker template / existing-server guide |
| REST/web paywall, usage, webhooks, account UI | `solvapay/sdk-integration` | `create-mcp-app`, checkout-only skills |
| Web hosted checkout + return URL | `solvapay/website-checkout` | Full SDK path, Lovable stack, greenfield MCP |
| Lovable paste-in (`@preview`, Supabase edge) | `solvapay/lovable-checkout` | Production Next.js website-checkout |
| Hosted / no-code MCP monetization (deprecated) | Router clarifies; surfaces should **not** auto-trigger | Do not use "MCP Pay" in eval copy — say "hosted / no-code MCP monetization" |

## Output evals (`evals.json`)

**Goal:** Does the skill produce correct routing, code, or artifacts?

**Run pattern:**

1. Clean session per run (no leftover skill-dev context).
2. **With skill:** point executor at `<skill-path>` from table above.
3. **Without skill:** same prompt, no skill (or snapshot of previous skill version as `old_skill/`).
4. Grade **assertions** with evidence → `grading.json`; record tokens/duration → `timing.json`.

**Workspace layout (gitignored):**

```text
eval-workspaces/<skill>/iteration-<N>/eval-<slug>/
  with_skill/{outputs/, timing.json, grading.json}
  without_skill/{outputs/, timing.json, grading.json}
benchmark.json   # aggregated at iteration-<N>/
```

Legacy path `evals/<skill>/iterations/` is also gitignored.

### `evals.json` schema

| Field | Required | Purpose |
| --- | --- | --- |
| `skill_name` | yes | Short name matching eval directory |
| `dev_mode_suffix` | no | Appended to every `prompt` when `EVAL_DEV_MODE=1` (create-mcp-app only today) |
| `evals[]` | yes | Cases: `id`, `slug`, `prompt`, `expected_output`, `files`, `assertions` |

Handoff / router cases assert **skill id** (`solvapay/sdk-integration`), not filesystem `../` paths.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `SKILLS_REPO` | Absolute path to this repo; substitute for `<skills-repo>` in prompts |
| `SCAFFOLDER_SCRIPTS_DIR` | Override for `create-solvapay/scripts/mcp` when bundled scripts cannot resolve |
| `EVAL_DEV_MODE=1` | Append `dev_mode_suffix` from `evals/create-mcp-app/evals.json` |

**Placeholders in prompts:** `<skills-repo>`, `<skill-path>` — never commit machine-specific absolute paths.

Default scaffolder path in prompts:

```text
<skills-repo>/skills/solvapay/create-mcp-app/scripts/describe.mjs
<skills-repo>/skills/solvapay/create-mcp-app/scripts/scaffold.mjs
```

## Source control

| Commit | Do not commit |
| --- | --- |
| `trigger-queries.json`, `evals.json`, `fixtures/` | `eval-workspaces/`, `evals/**/iterations/`, transcripts, `grading.json`, `timing.json`, `benchmark.json` |

## Validation (maintainers)

```bash
# Per trigger-queries.json (example for N=8)
jq '[.[] | select(.should_trigger)] | length' evals/solvapay/trigger-queries.json
jq '[.[] | select(.should_trigger == false)] | length' evals/solvapay/trigger-queries.json
# true count must equal false count; each in [8,10]

npm run validate
```

## Skill-specific notes

- [create-mcp-app/README.md](create-mcp-app/README.md) — fixtures, `--dev` / `EVAL_DEV_MODE`, scaffolder paths
