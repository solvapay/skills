---
name: create-mcp-app
description: >
  Create or scaffold a SolvaPay-monetized MCP server on Cloudflare Workers — from
  OpenAPI / Swagger or from scratch. Use when the user says "create mcp app",
  "scaffold mcp", "new mcp server", "openapi to mcp", "wrap rest api as mcp",
  "npm create solvapay", or wants a greenfield paid MCP worker. For humans at
  a terminal, point to `npm create solvapay@latest <name> -- --type mcp`. For agents,
  use describe.mjs + scaffold.mjs (intent-driven clustering requires an LLM).
---

# Create a Paid MCP App

A SolvaPay-monetized MCP server on Cloudflare Workers. Two input modes share the same destination: OpenAPI auto-generation, or hand-written tools.

> **Human at a terminal?** Fastest path: `npm create solvapay@latest <name> -- --type mcp` (or `pnpm`/`yarn create solvapay@latest`). The `@latest` suffix forces npm to re-resolve the registry every run so you always get the freshest scaffolder. Ships from-openapi (one-to-one) and from-scratch modes, runs install + `solvapay init` in one pass.
>
> **Agent (Claude / Cursor / etc.)?** Use the agent path: `scripts/describe.mjs` + `scripts/scaffold.mjs` per [from-openapi/guide.md](from-openapi/guide.md). It owns intent-driven clustering, per-operation curation, and hand-tuned narration — none of which the CLI exposes. The CLI cannot author `src/tools/*.ts` because that authoring step requires an LLM.

## Mandatory read order

Before writing any tool code, load these files in order:

1. [guide.md](guide.md) — routing decision (existing project vs greenfield, input mode, host).
2. [tool-design.md](tool-design.md) — the response-mode contract, gate rules, `registerPayable` shape.
3. Exactly one input-mode guide: [from-openapi/guide.md](from-openapi/guide.md) **or** [from-scratch/guide.md](from-scratch/guide.md) **or** [existing-server/guide.md](existing-server/guide.md).

Do not write `registerPayable(...)`, `additionalTools`, or new files under `src/tools/` until those three files are loaded. The detailed guardrails live in `guide.md` and `tool-design.md`; this block is the entry gate, not a duplicate of them.

**`tool-design.md` is non-negotiable**, including when you think you've seen the patterns before. It is the only file that pins down the `registerPayable(name, config)` two-argument shape, the `c.respond(data, { text })` response-mode contract, and the rule that paid handlers never return raw `content` arrays. Routing past it and authoring tools "from memory" is the single most common failure mode in this skill — the input-mode guides (`from-openapi/`, `from-scratch/`, `existing-server/`) build on it and do not duplicate its contract. If you find yourself about to call `registerPayable` and you cannot recall those rules verbatim, you have not read `tool-design.md`; stop and read it.

## First-decision routing

Pick one before scaffolding anything:

| Situation | Action |
| --- | --- |
| Existing `mcp-app` project (has `wrangler.jsonc`, `src/worker.ts` calling `createSolvaPayMcpFetch`) | **Do not scaffold.** Add tools under `src/tools/`, then run `npm run dev` and `node scripts/verify.mjs http://localhost:8787`. |
| Greenfield, human at a terminal | Run `npm create solvapay@latest <name> -- --type mcp` (interactive). |
| Greenfield, agent has an OpenAPI / Swagger doc | **Always use the agent path**: [from-openapi/guide.md](from-openapi/guide.md) with `scripts/describe.mjs` + `scripts/scaffold.mjs`. The published `npm create solvapay@latest -- --type mcp` CLI is for humans at a terminal — it only emits one-to-one tools and cannot author intent-driven dispatchers (those require the LLM). The agent path also supports one-to-one mode via `"mode": "one-to-one"` in `selections.json`, so falling back is one flag away. |
| Inside an unrelated app repo with no paid-MCP server in scope | **Ask** where the MCP server should live (sibling directory? `apps/mcp/`?). Do not scaffold into the app root. |

> **Dev mode (skill author / internal testing only).** If the user explicitly says they're testing against the SolvaPay dev backend, append `--dev` to every published-CLI invocation: `npm create solvapay@latest <name> -- --type mcp --dev` and `npx -y solvapay@latest init --dev`. The flag seeds `SOLVAPAY_API_BASE_URL=https://api-dev.solvapay.com` into `.env` and routes browser-auth, `wrangler dev`, deploy preflight, and the deployed worker to api-dev in one pass. Never enable `--dev` for end users — production keys are rejected by api-dev.

## Quick Start

1. Read [guide.md](guide.md) — the router that picks input mode, host, and sequences scaffold → init → deploy → verify → test.
2. Read [tool-design.md](tool-design.md) before writing any tool (load-bearing).
3. Follow the chosen input mode end-to-end:
   - [from-openapi/guide.md](from-openapi/guide.md) — generate from a spec (agent path)
   - [from-scratch/guide.md](from-scratch/guide.md) — hand-write paid tools after `npm create solvapay@latest -- --type mcp --no-openapi`
   - [existing-server/guide.md](existing-server/guide.md) — add SolvaPay to an MCP server that already exists
4. Wire credentials via [solvapay-init.md](solvapay-init.md).
5. Deploy to Cloudflare per [hosting/cloudflare.md](hosting/cloudflare.md) (or [hosting/alternatives.md](hosting/alternatives.md) for other hosts).

## Pointers

- Router and guardrails: [guide.md](guide.md)
- Shared tool-design contract: [tool-design.md](tool-design.md)
- Credential bootstrap: [solvapay-init.md](solvapay-init.md)
- OpenAPI mode: [from-openapi/](from-openapi/)
- Hand-written mode: [from-scratch/](from-scratch/)
- Existing-server integration: [existing-server/](existing-server/)
- Host details: [hosting/](hosting/)
