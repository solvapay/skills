# Agent Skills Best Practices

Canonical authoring standard for this repository, derived from [agentskills.io](https://agentskills.io). Use this guide when creating, editing, or reviewing skills.

**Index:** https://agentskills.io/llms.txt

---

## 1. Introduction — Progressive disclosure

Agents load skills in three layers ([specification](https://agentskills.io/specification#progressive-disclosure)):

| Layer | What loads | Budget | When |
| --- | --- | --- | --- |
| 1 | `name` + `description` | ~100 tokens per skill | Startup — all installed skills |
| 2 | `SKILL.md` body | < 500 lines / ~5,000 tokens recommended | On activation |
| 3 | `references/`, `scripts/`, `assets/` | As needed | When instructions say to load them |

Design every skill around this model. Put routing and non-negotiable guardrails in `SKILL.md`. Put detailed procedures, API shapes, and templates in referenced files — and tell the agent **when** to load each file.

---

## 2. Start from real expertise

Ground skills in domain knowledge the agent cannot infer ([best practices](https://agentskills.io/skill-creation/best-practices#start-from-real-expertise)).

**Extract from hands-on work**

- Complete a real task with an agent; capture corrections, I/O formats, and sequence that worked.
- Note where you steered the agent ("use X not Y", "check edge case Z").
- Turn recurring corrections into gotchas.

**Synthesize from project artifacts**

- Runbooks, API specs, review comments, fix PRs, incident reports.
- Prefer project-specific material over generic tutorials.

**Refine with real execution**

- Run the skill on real prompts; read execution traces, not just final output.
- If the agent wastes time on unproductive steps, tighten or remove instructions.
- When you correct the agent, add the correction to gotchas.

For structured iteration, see [Evaluating skill output quality](https://agentskills.io/skill-creation/evaluating-skills).

---

## 3. Spending context wisely

Every token in a skill competes with conversation history and other skills.

**Filter ruthlessly**

Ask of each paragraph: *"Would the agent get this wrong without this instruction?"* If no, cut it. Do not explain well-known concepts (HTTP, PDFs, React basics).

**Design coherent units**

- Too narrow → multiple skills load for one task.
- Too broad → hard to activate precisely; agent follows irrelevant instructions.

**Aim for moderate detail**

Concise stepwise guidance with one working example beats exhaustive edge-case catalogs. Let the agent use judgment for rare cases.

**Progressive disclosure in practice**

- Keep `SKILL.md` under 500 lines — router, guardrails, mandatory read order, checklists.
- Move depth to `references/` with explicit load triggers:
  - Good: "Read `references/api-errors.md` if the API returns a non-200 status."
  - Bad: "See references/ for details."
- Keep reference files focused (~300 lines target; split above ~500).
- Keep file references **one level deep** from `SKILL.md` (avoid file → file → file chains).

**Calibrate to agent knowledge**

- **Must teach:** project-specific APIs, SDK patterns, non-obvious conventions (e.g. SolvaPay `registerPayable` shape).
- **Behavioral direction only:** well-known tools (Next.js, Tailwind, Supabase) — preferences and corrections, not tutorials.

---

## 4. Skill format (spec essentials)

### Directory layout

```
skill-name/
├── SKILL.md          # Required: frontmatter + instructions
├── scripts/          # Optional: executable, tested helpers
├── references/       # Optional: on-demand documentation
├── assets/           # Optional: templates, schemas, static resources
└── ...
```

`name` in frontmatter must match the directory name.

### Frontmatter

| Field | Required | Notes |
| --- | --- | --- |
| `name` | Yes | ≤ 64 chars; lowercase, numbers, hyphens; no leading/trailing/consecutive hyphens |
| `description` | Yes | ≤ 1024 chars; what + when + trigger keywords |
| `compatibility` | No | ≤ 500 chars; environment requirements only when needed |
| `metadata` | No | e.g. `version: "1.0.0"` |
| `allowed-tools` | No | Experimental |

### Validation

```bash
skills-ref validate ./my-skill
# This repo:
npm run validate
```

Runs `skills-reference validate` per skill directory. Catches frontmatter drift; not a substitute for evals.

### File references

Use relative paths from the skill root:

```markdown
See [tool design](references/tool-design.md) before authoring tools.

Run: `node scripts/validate.mjs`
```

---

## 5. Calibrating control

Match specificity to fragility ([best practices](https://agentskills.io/skill-creation/best-practices#calibrating-control)).

| Situation | Approach |
| --- | --- |
| Multiple valid approaches; outcome tolerates variation | High freedom — explain *why*, let agent choose |
| Preferred pattern with acceptable variation | Medium freedom — pseudocode or template |
| Fragile sequence, consistency critical, destructive ops | Low freedom — exact commands, no flag changes |

**Defaults, not menus**

Pick one recommended tool or approach. Mention alternatives only when context genuinely differs.

**Procedures over declarations**

Teach *how to approach* a class of problems, not the answer to one instance. Templates, guardrails, and tool-specific shapes are fine when they generalize.

---

## 6. Instruction patterns

Use patterns that fit the task; not every skill needs all of them.

### Gotchas

Highest-value content: concrete corrections to mistakes the agent will make.

```markdown
## Gotchas

- The `/health` endpoint returns 200 even when the database is down. Use `/ready`.
- `user_id` in the DB is `uid` in auth and `accountId` in billing — same value.
```

Keep critical gotchas in `SKILL.md` or tell the agent exactly when to load a gotchas reference.

### Templates

For required output shapes, provide a copyable template (inline or in `assets/`).

### Checklists

Multi-step workflows with dependencies:

```markdown
## Task progress

- [ ] Step 1: Analyze inputs
- [ ] Step 2: Validate mapping
- [ ] Step 3: Execute
- [ ] Step 4: Verify output
```

### Validation loops

Do work → validate (script, checklist, or self-check) → fix → repeat until pass.

### Plan-validate-execute

For batch or destructive work: produce a structured plan → validate against source of truth → execute only after validation passes.

### Guardrails

Explicit **Never** / **Always** rules near the top of `SKILL.md` or the relevant section.

---

## 7. Scripts

Bundle repeated agent logic in `scripts/` ([using scripts](https://agentskills.io/skill-creation/using-scripts)).

**When to bundle**

If traces show the agent reinventing the same logic each run (parsers, validators, chart builders), write a tested script once.

**One-off commands**

For simple invocations, reference pinned package runners in `SKILL.md`:

```bash
npx eslint@9 --fix .
uvx ruff@0.8.0 check .
```

State prerequisites in `SKILL.md` or `compatibility`. Move complex commands into scripts.

**Agentic script design**

- **Non-interactive** — no TTY prompts; use flags, env vars, or stdin.
- **`--help`** — concise usage, flags, examples.
- **Structured output** — JSON/CSV to stdout; diagnostics to stderr.
- **Clear errors** — what failed, what was expected, what to try next.
- **Idempotent** where possible; meaningful exit codes; `--dry-run` for destructive ops.

List scripts in `SKILL.md` and distinguish **Run** `scripts/x.py` vs **See** `scripts/x.py` (read-only).

---

## 8. Descriptions and discovery

The `description` is the primary trigger mechanism ([optimizing descriptions](https://agentskills.io/skill-creation/optimizing-descriptions)).

**Principles**

- **Imperative framing:** "Use this skill when…" — the agent decides whether to act.
- **User intent, not internals:** match what the user asks for, not file layout.
- **What + when + keywords:** scope and trigger phrases.
- **Err on pushy for surface skills:** list contexts where the skill applies, including cases where the user doesn't name the domain directly.
- **≤ 1024 characters.**

**Router vs surface skills**

In a multi-skill family, the router owns ambiguous / top-of-funnel triggers. Surface skills own specific implementation keywords. Avoid keyword competition between router and siblings.

**Trigger eval queries**

Maintain ~20 labeled queries (8–10 should-trigger, 8–10 should-not-trigger). Include near-miss negatives. Split train (~60%) / validation (~40%) when optimizing descriptions. Run each query multiple times; target trigger rate thresholds (e.g. 0.5).

---

## 9. Eval-driven iteration

Test whether the skill works reliably ([evaluating skills](https://agentskills.io/skill-creation/evaluating-skills)).

**Test case shape**

- Realistic **prompt**
- Human-readable **expected output**
- Optional **input files**
- **Assertions** (add after first run — verifiable, not vague)

Store in `evals/evals.json` inside the skill, or in a repo-level workspace if eval payload bloats the skill.

**Workspace layout**

```
skill-name/
├── SKILL.md
└── evals/evals.json
skill-name-workspace/
└── iteration-1/
    ├── eval-<case>/
    │   ├── with_skill/outputs|timing.json|grading.json
    │   └── without_skill/...
    └── benchmark.json
```

**Run pattern**

- Clean context per run.
- Compare with-skill vs without-skill (or previous version).
- Grade assertions with evidence; aggregate pass rate, time, tokens.
- Human review catches what assertions miss.

**Iteration rules**

- Generalize fixes — don't patch for one eval phrasing.
- Keep the skill lean; remove instructions that cause wasted work.
- Explain *why* in instructions when it improves compliance.
- Bundle repeated work into `scripts/`.

Stop when pass rates plateau, validation feedback is empty, or improvements aren't meaningful.

---

## 10. Authoring checklist

Copy before shipping or reviewing a skill:

**Structure**

- [ ] `SKILL.md` exists; `name` matches directory
- [ ] Frontmatter complete (`description`, `metadata.version`; `compatibility` if needed)
- [ ] `SKILL.md` < 500 lines
- [ ] Standard folders: `references/`, `scripts/`, `assets/` (not ad-hoc root layouts)
- [ ] References focused (< ~300 lines ideal; flag > 500)
- [ ] File references one level deep from `SKILL.md`
- [ ] `npm run validate` passes

**Content**

- [ ] Every section passes "would the agent get this wrong?"
- [ ] Gotchas for known failure modes
- [ ] Guardrails (Never / Always) explicit
- [ ] Checklist for multi-step workflows
- [ ] Validation loop before handoff
- [ ] Mandatory read order stated for load-bearing references
- [ ] One default path; alternatives only when context differs

**Discovery**

- [ ] Description ≤ 1024 chars; what + when + keywords
- [ ] Router/surface keyword separation (if part of a family)
- [ ] Trigger eval query set exists or is planned

**Scripts & evals**

- [ ] Repeated logic in `scripts/` (non-interactive, `--help`, structured output)
- [ ] Output evals with assertions for critical flows
- [ ] Eval workspace outside skill payload if bloated

---

## 11. Further reading

- [Specification](https://agentskills.io/specification)
- [Best practices for skill creators](https://agentskills.io/skill-creation/best-practices)
- [Using scripts in skills](https://agentskills.io/skill-creation/using-scripts)
- [Optimizing skill descriptions](https://agentskills.io/skill-creation/optimizing-descriptions)
- [Evaluating skill output quality](https://agentskills.io/skill-creation/evaluating-skills)
- [Quickstart](https://agentskills.io/skill-creation/quickstart)
