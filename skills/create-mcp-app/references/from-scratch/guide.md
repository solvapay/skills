# From scratch — hand-written paid MCP tools

Build a SolvaPay-paywalled MCP server without an OpenAPI spec. The scaffolder lays down a working Cloudflare Workers project with one placeholder paid tool; you replace the placeholder and add more paid tools by hand.

> Arrived from [../../SKILL.md](../../SKILL.md)? Right place. If you actually have an OpenAPI / Swagger document, stop and route to [../from-openapi/guide.md](../from-openapi/guide.md) — the spec-first path produces a typed server with less hand-coding. If you have an MCP server that already exists and only want to add a paywall, route to [../existing-server.md](../existing-server.md) instead.

## Agent-driven path (this is you)

In Claude Code or Cursor with this skill installed:

- **Greenfield, no spec**: say _"Scaffold a paid MCP server, no OpenAPI"_ — the agent runs the scaffolder for you, replaces the placeholder tool with your business logic, and walks through deploy/verify/test.
- **Already scaffolded, want to add another paid tool**: say _"Add another paid tool to my MCP server"_ — the agent jumps straight to [scaffold-and-extend.md](scaffold-and-extend.md).

## Human shortcut (terminal users only)

For humans at a terminal:

```bash
npm create solvapay@latest my-mcp -- --type mcp --no-openapi
# or: pnpm create solvapay@latest my-mcp -- --type mcp --no-openapi
# or: yarn create solvapay@latest my-mcp -- --type mcp --no-openapi
```

The `@latest` suffix re-resolves the npm registry every run, so the user picks up the freshest scaffolder without clearing the npx cache.

The CLI asks for a project name and a camelCase tool name (default `helloTool`), drops you into a working Cloudflare Workers MCP shell with one placeholder paid tool, the SolvaPay paywall wired up, and `.env` populated by the browser-based `solvapay init` flow. The first deploy works without writing any code.

## Guardrails

See [../../SKILL.md](../../SKILL.md) for the umbrella's guardrails block. All apply to hand-written tools.

## State-based routing

| User state | Route to |
| --- | --- |
| I'm about to scaffold a hand-written project | Run the scaffolder above, then [scaffold-and-extend.md](scaffold-and-extend.md) |
| I just ran the scaffolder, what's in the project? | [scaffold-and-extend.md](scaffold-and-extend.md) |
| I want to replace the placeholder tool with real business logic | [scaffold-and-extend.md](scaffold-and-extend.md) (Replace the placeholder section) |
| I want to add another paid tool to a scaffolded project | [scaffold-and-extend.md](scaffold-and-extend.md) (Add another paid tool section) |
| I'm ready to design tool shapes (response modes, narration, annotations) | [../tool-design.md](../tool-design.md) |
| I have a local worker and want to wire SolvaPay credentials | [../solvapay-init.md](../solvapay-init.md) |
| I have credentials and want to deploy | [../hosting/cloudflare/](../hosting/cloudflare/) (Cloudflare default) or [../hosting/alternatives.md](../hosting/alternatives.md) (other hosts) |

## End-to-end happy path

```
npm create solvapay@latest (--no-openapi) → scaffold-and-extend → tool-design (read before authoring) → solvapay-init → deploy → verify → test
```

`solvapay init`, deploy, verify, and test work the same way as the from-openapi flow — see [../solvapay-init.md](../solvapay-init.md) and [../hosting/cloudflare/](../hosting/cloudflare/) for the shared steps.

## Pre-read (required)

Read [../tool-design.md](../tool-design.md) before writing any tool code. It covers the three response modes (silent / nudge / gate), intent composition with the recovery tools, annotations, and the rule that payable tools return data for the host to render — not iframes. This is load-bearing.

## What's intentionally not here

- Auto-generation from a spec — see [../from-openapi/guide.md](../from-openapi/guide.md).
- Paywalling a server that already exists — see [../existing-server.md](../existing-server.md).
- Cloudflare-specific deploy steps — see [../hosting/cloudflare/](../hosting/cloudflare/).
- Credential bootstrap — see [../solvapay-init.md](../solvapay-init.md).

## Task progress

- [ ] Run `npm create solvapay@latest <name> -- --type mcp --no-openapi`
- [ ] Read [../tool-design.md](../tool-design.md)
- [ ] Follow [scaffold-and-extend.md](scaffold-and-extend.md) to replace the placeholder and add more paid tools
- [ ] Run [../solvapay-init.md](../solvapay-init.md) to populate credentials
- [ ] Deploy per [../hosting/cloudflare/](../hosting/cloudflare/)
- [ ] Verify success + gate paths in sandbox
