# From scratch — hand-written paid MCP tools

Build a SolvaPay-paywalled MCP server without an OpenAPI spec, in TypeScript, Python or Go. The scaffolder lays down a working project with a placeholder paid tool (Python and Go also get one free capped tool); you replace the placeholders and add more tools by hand.

> Arrived from [../../SKILL.md](../../SKILL.md)? Right place. If you have an OpenAPI / Swagger document and the server is TypeScript, route to [../from-openapi/guide.md](../from-openapi/guide.md). If you have an MCP server that already exists and only want to add a paywall, route to [../existing-server.md](../existing-server.md).

## Scaffold

Check the toolchain and the CLI first (from the skill directory):

```bash
node scripts/check-toolchain.mjs --language <ts|python|go>
```

Do not scaffold while it prints `fail`. Then:

| Language | Command | Produces |
| --- | --- | --- |
| TypeScript | `npm create solvapay@latest my-mcp -- --type mcp --language ts --no-openapi` | Cloudflare Workers project: `src/worker.ts`, `src/tools/<tool>.ts`, `wrangler.jsonc`, `scripts/deploy.mjs`, `verify.mjs`, `test.mjs` |
| Python | `npm create solvapay@latest my-mcp -- --type mcp --language python` | uv project: `pyproject.toml`, `server.py`, `tools.py`, `tests/test_tools.py`, `.env.example`, `Dockerfile`, `.github/dependabot.yml` |
| Go | `npm create solvapay@latest my-mcp -- --type mcp --language go` | Go module: `go.mod`, `main.go`, `tools.go`, `tools_test.go`, `.env.example`, multi-stage `Dockerfile`, `.github/dependabot.yml` |

`npx create-solvapay@latest my-mcp --type mcp --language <l>` is the same command. If the check said the CLI does not list `--language`, drop the flag for TypeScript (it is the default); Python and Go cannot be scaffolded with that CLI.

The CLI runs `solvapay init` at the end (browser sign-in, `.env`). Expect it to pause for a human click; run it where the user can approve, and treat a quiet wait as expected.

## Human shortcut (terminal users only)

```bash
npm create solvapay@latest my-mcp -- --type mcp --language python
# or: pnpm create solvapay@latest my-mcp -- --type mcp --language go
```

The `@latest` suffix re-resolves the npm registry every run, so the user gets the newest scaffolder without clearing the npx cache.

## Guardrails

See [../../SKILL.md](../../SKILL.md) for the guardrails block. All apply to hand-written tools.

## State-based routing

| User state | Route to |
| --- | --- |
| About to scaffold | The Scaffold section above |
| TypeScript, just scaffolded, what's in the project? | [scaffold-and-extend.md](scaffold-and-extend.md) |
| TypeScript, replace the placeholder or add a tool | [scaffold-and-extend.md](scaffold-and-extend.md) |
| Python or Go, replace the placeholders or add a tool | Your language file: Register a paid tool, Free tool |
| Designing tool shapes (response modes, narration, annotations) | [../tool-design.md](../tool-design.md) |
| Wiring SolvaPay credentials | [../solvapay-init.md](../solvapay-init.md) |
| Deploying | TypeScript: [../hosting/cloudflare/README.md](../hosting/cloudflare/README.md); Python, Go: [../hosting/container.md](../hosting/container.md) |
| Selling the tools to agents too | [../agent-payments.md](../agent-payments.md) |

## End-to-end happy path

```
check-toolchain → npm create solvapay (--language) → tool-design + language file → replace placeholders → solvapay init → doctor → tests → run locally + verify → deploy → verify
```

## Pre-read (required)

Read [../tool-design.md](../tool-design.md) and the one language file SKILL.md picked before writing any tool code. They cover the response modes, intent composition, identity and the rule that paid tools return data for the host to render — not iframes.

## Python and Go placeholder tools

The scaffold registers one paid tool (`register_payable` / `RegisterPayable`) and one free capped tool (`register_free` / `RegisterFree`) so the paywall is verifiable before you write business logic:

- Replace the placeholder handler bodies with real logic, keeping the respond-with-narration shape.
- Rename the tools to snake_case verbs that say what they do, and rewrite each description: it is the only signal the model gets for when to call the tool.
- Update the tests (`tests/test_tools.py` / `tools_test.go`) to the new names and run `uv run pytest` / `go test ./...`.
- Keep the free capped tool only if the product really has a free allowance; otherwise delete it.

## What's intentionally not here

- Auto-generation from a spec — see [../from-openapi/guide.md](../from-openapi/guide.md) (TypeScript).
- Paywalling a server that already exists — see [../existing-server.md](../existing-server.md).
- Deploy steps — see the hosting guides above.
- Credential bootstrap — see [../solvapay-init.md](../solvapay-init.md).

## Task progress

- [ ] `node scripts/check-toolchain.mjs --language <l>` passes
- [ ] Scaffold with `npm create solvapay@latest <name> -- --type mcp --language <l>`
- [ ] Read [../tool-design.md](../tool-design.md) and the language file
- [ ] Replace the placeholder tools (TypeScript: [scaffold-and-extend.md](scaffold-and-extend.md))
- [ ] Run [../solvapay-init.md](../solvapay-init.md) if `.env` is not filled in; confirm the product
- [ ] `npx -y solvapay@latest doctor`, then the tests
- [ ] Run locally and verify; deploy; verify again
