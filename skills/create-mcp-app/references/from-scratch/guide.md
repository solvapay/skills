# From scratch — hand-written paid MCP tools

Build a SolvaPay-paywalled MCP server without an OpenAPI spec. The scaffolder lays down a working project with one placeholder paid tool in the language you picked. You replace the placeholder and add more paid tools by hand.

Language is a parameter. Read **exactly one** file from the SKILL.md matrix (`references/languages/<id>.md`) plus [../languages/toolchain-gate.md](../languages/toolchain-gate.md). Do not open a second language file.

> Arrived from [../../SKILL.md](../../SKILL.md)? Right place. If you have an OpenAPI / Swagger document **and** the language row lists `openapi`, stop and route to [../from-openapi/guide.md](../from-openapi/guide.md). If you have an MCP server that already exists, route to [../existing-server.md](../existing-server.md).

## Agent-driven path

- **Greenfield, no spec**: run `scripts/check-toolchain.mjs --language <id>`, then `scripts/scaffold-app.mjs <dir> --language <id> --tool-name <snake_case>`. Replace the placeholder using the language file.
- **Already scaffolded, add another paid tool**: [scaffold-and-extend.md](scaffold-and-extend.md) plus the same language file.

## Human shortcut

```bash
npm create solvapay@latest my-mcp -- --type mcp --language <id> --no-openapi --tool-name generate_haiku
```

`<id>` is `ts`, `python`, `ruby`, `go`, or `rust`. The CLI installs dependencies and runs `solvapay init --language <id>`. Pass `--module` on Go.

Use snake_case for `--tool-name` (the MCP identifier). After scaffold, follow [scaffold-and-extend.md](scaffold-and-extend.md) for replace / add, using the language file for the registration and respond calls.

## Guardrails

SKILL.md guardrails all apply. Also: never scaffold when the toolchain gate fails; never treat a `⚠️` install line as success.

## State-based routing

| User state | Route to |
| --- | --- |
| About to scaffold | Toolchain gate → `scaffold-app.mjs --language <id>` → [scaffold-and-extend.md](scaffold-and-extend.md) |
| Just scaffolded / replace placeholder / add a tool | [scaffold-and-extend.md](scaffold-and-extend.md) + the language file |
| Designing tool shapes | [../tool-design.md](../tool-design.md) |
| Wiring credentials | [../solvapay-init.md](../solvapay-init.md) (`init --language <id>`) |
| Ready to run / deploy | Serve command and port from the SKILL.md matrix; TypeScript extra hosts in [../hosting/alternatives.md](../hosting/alternatives.md) |

## End-to-end happy path

```
check-toolchain --language <id> → scaffold-app --language <id> → language file (author) → solvapay init --language <id> → serve from matrix → verify
```

## Pre-read (required)

[../tool-design.md](../tool-design.md) and exactly one `references/languages/<id>.md` before writing tool code.

## What's intentionally not here

- Auto-generation from a spec — [../from-openapi/guide.md](../from-openapi/guide.md) (`ts` only).
- Paywalling a server that already exists — [../existing-server.md](../existing-server.md).
- Per-language syntax — the language file, not this guide.

## Task progress

- [ ] `node scripts/check-toolchain.mjs --language <id>` prints `ok`
- [ ] `node scripts/scaffold-app.mjs <dir> --language <id> --tool-name <snake>`
- [ ] Read [../tool-design.md](../tool-design.md) + the one language file
- [ ] Follow [scaffold-and-extend.md](scaffold-and-extend.md)
- [ ] [../solvapay-init.md](../solvapay-init.md) with `--language <id>`
- [ ] Serve using the matrix command and verify success + gate paths
