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

## Read order

1. Start with [setup.md](setup.md) to understand the steps end-to-end.
2. Pull templates from [widget-templates-config.md](widget-templates-config.md) and [widget-templates-widget-and-scripts.md](widget-templates-widget-and-scripts.md) as each setup step calls for them.
3. Continue to [deploy-verify.md](deploy-verify.md).
4. Reach for [troubleshooting.md](troubleshooting.md) when something doesn't work.

## Guardrails

- Never commit `.env`. Only `.env.example` is tracked. The gitignore template in [widget-templates-widget-and-scripts.md](widget-templates-widget-and-scripts.md#gitignore) enforces this.
- Never put `SOLVAPAY_SECRET_KEY` in `wrangler.jsonc` `vars` or in a `--var` flag. `npm run deploy` uploads it from `.env` as a Worker secret on first deploy; it persists across deploys after that.
- Never remove `mode: 'json-stateless'` from the `createSolvaPayMcpFetch` call. Workers isolates don't pin across requests — stateful MCP sessions break.
- Never set `_meta.ui.resourceUri` on merchant payable tools. `registerPayable` enforces this, but if you drop down to `registerPayableTool`, don't pass a `resourceUri`.
- Always keep `hideToolsByAudience: ['ui']` unless you have a specific reason not to.
