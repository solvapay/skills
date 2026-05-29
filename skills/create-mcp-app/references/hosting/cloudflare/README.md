# Cloudflare Workers Deploy (Default, Bulletproof)

Step-by-step deploy of a SolvaPay MCP server on Cloudflare Workers, with every file inline. Self-contained — no external templates, no repo cloning.

Split into four focused files so you can load only the section you need.

## Files

| File | Purpose |
| --- | --- |
| [setup.md](setup.md) | Steps 1–7: prerequisites, scaffold layout, install, configure, env + secret, build the widget, local dev. |
| [widget-templates-config.md](widget-templates-config.md) | Config templates: `package.json`, `tsconfig.json`, `wrangler.jsonc`, `vite.config.ts`, `mcp-app.html`, `src/assets.d.ts`, `src/worker.ts`. |
| [widget-templates-widget-and-scripts.md](widget-templates-widget-and-scripts.md) | Widget + scripts: `src/mcp-app.tsx`, `scripts/deploy.mjs`, `scripts/dev.mjs`, `.env.example`, `.gitignore`. |
| [deploy-verify.md](deploy-verify.md) | Step 8 (deploy) + Step 9 (gate smoke test). |
| [troubleshooting.md](troubleshooting.md) | Common failure modes and fixes. |

## Existing project?

If the project already has `src/worker.ts` calling `createSolvaPayMcpFetch` or `createSolvaPayMcpServer`, this is a **deploy-existing** task — not greenfield scaffold:

- Jump to [deploy-verify.md](deploy-verify.md) (Step 8 deploy + Step 9 verify).
- Add only deploy scaffolding: `scripts/deploy.mjs`, `wrangler.jsonc` `[vars]`, `.env`.
- **Leave `src/worker.ts` byte-for-byte unchanged** — do not write `src/tools/*` or widget files from the templates.
- Run `npx wrangler whoami` as a pre-flight check before deploy (confirms auth + prints your `*.workers.dev` subdomain).

## Read order

1. Start with [setup.md](setup.md) to understand the steps end-to-end.
2. Pull templates from [widget-templates-config.md](widget-templates-config.md) and [widget-templates-widget-and-scripts.md](widget-templates-widget-and-scripts.md) as each setup step calls for them.
3. Continue to [deploy-verify.md](deploy-verify.md).
4. Reach for [troubleshooting.md](troubleshooting.md) when something doesn't work.

## Guardrails

See create-mcp-app SKILL.md guardrails (Never/Always for secrets, json-stateless, resourceUri, hideToolsByAudience).
