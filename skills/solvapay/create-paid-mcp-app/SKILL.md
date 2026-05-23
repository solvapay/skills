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

> **Human at a terminal?** The fastest path is the published scaffolder: `npm create paid-mcp-app <name>` (or `pnpm create paid-mcp-app`, `yarn create paid-mcp-app`). It ships both from-openapi (one-to-one mode) and from-scratch modes, runs the project-local install, and invokes `solvapay init` for auth + product picker. The modules below are the agent path — they own intent-driven mode and per-operation curation, which the CLI deliberately defers.

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
