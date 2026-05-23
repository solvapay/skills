---
name: create-paid-mcp-app
description: >
  Build a paid MCP app — a SolvaPay-monetized MCP server on Cloudflare Workers, from
  either an OpenAPI / Swagger document (auto-generated tools) or hand-written tools.
  Use when a developer says "paid mcp", "monetize mcp", "paywall mcp", "mcp with
  payments", "mcp billing", "openapi to mcp", "wrap rest api as mcp", "build mcp app",
  "new mcp server", "scaffold mcp", "add solvapay to my mcp", or any combination
  routing toward a paywalled MCP server.
---

# Create a Paid MCP App

A SolvaPay-monetized MCP server on Cloudflare Workers. Two input modes share the same destination: OpenAPI auto-generation, or hand-written tools.

> **Human at a terminal?** Fastest path: `npm create paid-mcp-app <name>` (or `pnpm`/`yarn create paid-mcp-app`). Ships from-openapi (one-to-one) and from-scratch modes, runs install + `solvapay init` in one pass.
>
> **Agent (Claude / Cursor / etc.)?** Use the agent path: `scripts/describe.mjs` + `scripts/scaffold.mjs` per [from-openapi/guide.md](from-openapi/guide.md). It owns intent-driven clustering, per-operation curation, and hand-tuned narration — none of which the CLI exposes. The CLI cannot author `src/tools/*.ts` because that authoring step requires an LLM.

## Mandatory read order

Before writing any tool code, load these files in order:

1. [guide.md](guide.md) — routing decision (existing project vs greenfield, input mode, host).
2. [tool-design.md](tool-design.md) — the response-mode contract, gate rules, `registerPayable` shape.
3. Exactly one input-mode guide: [from-openapi/guide.md](from-openapi/guide.md) **or** [from-scratch/new.md](from-scratch/new.md) **or** [from-scratch/existing.md](from-scratch/existing.md).

Do not write `registerPayable(...)`, `additionalTools`, or new files under `src/tools/` until those three files are loaded. The detailed guardrails live in `guide.md` and `tool-design.md`; this block is the entry gate, not a duplicate of them.

## First-decision routing

Pick one before scaffolding anything:

| Situation | Action |
| --- | --- |
| Existing `create-paid-mcp-app` project (has `wrangler.jsonc`, `src/worker.ts` calling `createSolvaPayMcpFetch`) | **Do not scaffold.** Add tools under `src/tools/`, then run `npm run dev` and `node scripts/verify.mjs http://localhost:8787`. |
| Greenfield, human at a terminal | Run `npm create paid-mcp-app <name>` (interactive). |
| Greenfield, agent has an OpenAPI / Swagger doc | **Always use the agent path**: [from-openapi/guide.md](from-openapi/guide.md) with `scripts/describe.mjs` + `scripts/scaffold.mjs`. The published `npm create paid-mcp-app` CLI is for humans at a terminal — it only emits one-to-one tools and cannot author intent-driven dispatchers (those require the LLM). The agent path also supports one-to-one mode via `"mode": "one-to-one"` in `selections.json`, so falling back is one flag away. |
| Inside an unrelated app repo with no paid-MCP server in scope | **Ask** where the MCP server should live (sibling directory? `apps/mcp/`?). Do not scaffold into the app root. |

## Quick Start

1. Read [guide.md](guide.md) — the router that picks input mode, host, and sequences scaffold → init → deploy → verify → test.
2. Read [tool-design.md](tool-design.md) before writing any tool (load-bearing).
3. Follow the chosen input mode end-to-end:
   - [from-openapi/guide.md](from-openapi/guide.md) — generate from a spec (agent path)
   - [from-scratch/new.md](from-scratch/new.md) — guide for adding more paid tools after `npm create paid-mcp-app`
   - [from-scratch/existing.md](from-scratch/existing.md) — add SolvaPay to an existing MCP server
4. Wire credentials via [solvapay-init.md](solvapay-init.md).
5. Deploy to Cloudflare per [hosting/cloudflare.md](hosting/cloudflare.md) (or [hosting/alternatives.md](hosting/alternatives.md) for other hosts).

## Pointers

- Router and guardrails: [guide.md](guide.md)
- Shared tool-design contract: [tool-design.md](tool-design.md)
- Credential bootstrap: [solvapay-init.md](solvapay-init.md)
- OpenAPI mode: [from-openapi/](from-openapi/)
- Hand-written mode: [from-scratch/](from-scratch/)
- Host details: [hosting/](hosting/)
