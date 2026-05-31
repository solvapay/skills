# Human-in-the-loop conventions

Single source of truth for confirmation gates across this skill. Loaded once by [SKILL.md](../SKILL.md); referenced by every gate in `from-openapi/` (and reusable from `from-scratch/` if it ever needs gates).

The goal: agents present **named, numbered decision points** with stable ids so users can opt in to more or less interruption with one toggle, and so eval transcripts can grep for `G2:approve` regardless of which host rendered the prompt.

## Confirmation level (G0)

Picked once at the start of the flow. Carries through the whole skill.

| Level                | Default? | What fires                                                                                            |
| -------------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| `auto`               | no       | G0, G1, G5, G6 (scaffold confirm only, no preview), G8 via `--yes`, G9                                |
| `standard`           | **yes**  | G0, G1, G2, G4, G5, G6, G8, G9                                                                        |
| `chatty`             | no       | All gates (G0–G9), including G3 per-intent design and G7 post-scaffold summary                        |

`auto` deliberately keeps **G5** (upstream auth key — the user must supply secrets), **G6** (scaffold confirm — destructive filesystem write), **G8** (deploy — pushes code to Cloudflare), and **G9** (go-live key swap — sandbox → live). These are not "cosmetic" gates and never collapse, regardless of level.

`standard` is the default. Do not set a level on the user's behalf — ask G0 first.

## Structured-question contract

Every gate is defined with this shape:

```
GateId: G<n>
Prompt:  <one-sentence question the user must answer>
Options:
  - <optionId>: <short label shown to the user>
  - <optionId>: <short label>
  - ...
```

`GateId` (`G0`–`G9`) and `optionId` (`approve`, `edit`, `oneToOne`, `run`, etc.) are stable. Eval transcripts and follow-up agents can grep for `G2:approve` regardless of which host rendered the prompt.

### Rendering by host

| Host                                                     | Render path                                                                                                              |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Cursor (has `AskQuestion` tool)                          | Call `AskQuestion` with `questions: [{ id: "G<n>", prompt, options: [{ id: "<optionId>", label }, ...] }]`                |
| Claude Code (structured prompts)                         | Use the equivalent structured-question primitive with the same `id` / `optionId` strings                                  |
| Codex / other agents with native structured-question     | Use their primitive with the same `id` / `optionId` strings                                                               |
| Anything else (text-only chat, REPL, automation harness) | Render the markdown fallback below                                                                                       |

### Markdown fallback

When the host has no structured-question primitive, render:

```
### G<n> — <prompt>

<optional supporting table or preview>

- a: <option 1 label>
- b: <option 2 label>
- c: <option 3 label>

Reply with a / b / c, or describe changes.
```

The letter prefixes (`a`/`b`/`c`) map back to the canonical `optionId`s in the order listed in the gate definition. After the user replies, log the resolved choice in the canonical `G<n>:<optionId>` form so transcripts stay greppable.

## Gate reference

The full table lives in [from-openapi/guide.md](from-openapi/guide.md). Quick index for cross-cutting reference:

| Gate                            | Fires at                               | Where it lives                                   |
| ------------------------------- | -------------------------------------- | ------------------------------------------------ |
| G0 — pick confirmation level    | always                                 | [from-openapi/guide.md](from-openapi/guide.md)   |
| G1 — generation mode            | always                                 | [from-openapi/describe.md](from-openapi/describe.md) |
| G2 — cluster proposal           | standard, chatty (intent-driven only)  | [from-openapi/intent-driven.md](from-openapi/intent-driven.md) |
| G3 — per-intent design          | chatty only (intent-driven only)       | [from-openapi/intent-driven.md](from-openapi/intent-driven.md) |
| G4 — tier overrides             | standard, chatty (one-to-one only)     | [from-openapi/describe.md](from-openapi/describe.md) |
| G5 — upstreamAuth shape + key   | always                                 | [from-openapi/describe.md](from-openapi/describe.md) |
| G6 — selections.json preview    | standard, chatty                       | [from-openapi/scaffold.md](from-openapi/scaffold.md) |
| G7 — post-scaffold file summary | chatty only                            | [from-openapi/intent-driven.md](from-openapi/intent-driven.md) |
| G8 — deploy confirm             | standard, chatty (auto passes `--yes`) | [from-openapi/deploy.md](from-openapi/deploy.md) |
| G9 — go-live key swap           | always (overrides auto)                | [from-openapi/deploy.md](from-openapi/deploy.md) |

## Redaction

When a gate previews a payload that includes secrets, redact before rendering:

| Field                              | Redacted form  |
| ---------------------------------- | -------------- |
| `upstreamAuth.key`                 | `"<redacted>"` |
| `upstreamAuth.clientSecret`        | `"<redacted>"` |
| `upstreamAuth.headers[].value`     | `"<redacted>"` (redact **every** entry's value; `name` renders verbatim) |
| Any field whose name ends `secret` | `"<redacted>"` |
| Any field whose name ends `Key`    | `"<redacted>"` (when value looks like a token / >12 chars and not a URL) |

Never store the redaction; the on-disk file still carries the real value. Redaction is render-time only.

## Examples

### G0 — pick confirmation level (always)

```
GateId: G0
Prompt: How chatty should I be? `standard` (default) asks before each big decision; `auto` only confirms the irreversible steps; `chatty` reviews every intent and file.
Options:
  - standard: standard (recommended) — confirm mode, tiers, auth, scaffold, deploy
  - auto:     auto — only confirm scaffold + deploy + go-live; pick everything else myself
  - chatty:   chatty — review every cluster, every intent design, every file before write
```

### G2 — cluster proposal (intent-driven, standard + chatty)

```
GateId: G2
Prompt: I'd cluster the 23 operations into 4 intent tools. Approve, edit, or switch to one-to-one mode?
Options:
  - approve:  Approve — write selections.json and run scaffold
  - edit:     Edit — describe merges, splits, or renames
  - oneToOne: Switch to one-to-one mode (one file per operation)
```

Render the cluster proposal as a supporting table above the options:

```
| intent_name  | ops covered                                  | tier | one-line description |
| ------------ | -------------------------------------------- | ---- | -------------------- |
| manage_pet   | POST /pet, PUT /pet, DELETE /pet/{id}        | paid | CRUD on pets         |
| find_pet     | GET /pet/{id}, GET /pet/findByStatus         | free | read-only lookups    |
| manage_order | POST /store/order, GET /store/order/{id}     | paid | order management     |
```

### G6 — selections.json preview (standard + chatty)

```
GateId: G6
Prompt: Here's the resolved selections.json. Run scaffold or edit?
Options:
  - run:  Run scaffold — write the project
  - edit: Edit — change tiers, auth, worker name, or mode
```

Render the JSON above the options with `upstreamAuth.key` / `clientSecret` replaced by `"<redacted>"`.

## Why this shape

- **One toggle, one decision.** G0 is the only meta-question the user has to answer. Everything else follows from it.
- **Tool-agnostic.** The same `{ id, prompt, options }` contract maps cleanly to `AskQuestion`, Claude Code structured prompts, and the markdown fallback. Skills don't need to know which host they're running in.
- **Irreversible boundary preserved.** Scaffold (G6), deploy (G8), and go-live key swap (G9) always confirm — even at `auto`. Only cosmetic / reversible gates collapse at lower levels.
- **Eval-grade traceability.** The stable `G<n>:<optionId>` form lets evals assert "agent surfaced G2 and waited for approval" rather than fragile keyword matching.
