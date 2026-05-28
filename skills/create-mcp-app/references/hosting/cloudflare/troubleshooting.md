# Cloudflare Workers — Troubleshooting

Common failure modes when deploying a SolvaPay MCP server on Cloudflare Workers, with fixes. Pair with [setup.md](setup.md) (steps), [widget-templates-config.md](widget-templates-config.md) / [widget-templates-widget-and-scripts.md](widget-templates-widget-and-scripts.md) (file templates), and [deploy-verify.md](deploy-verify.md) (deploy steps).

## `SOLVAPAY_SECRET_KEY is not set` at runtime

`.env` was missing or the value wasn't picked up at deploy time. `npm run deploy` reads `.env` and uploads the secret on the first deploy; verify `.env` has a real `sk_test_…` / `sk_live_…` value and re-run.

## OAuth discovery returns the placeholder `MCP_PUBLIC_BASE_URL`

Your `.env` wasn't sourced. Check that `.env` exists in the project root and that `scripts/deploy.mjs` printed no "not found" warning.

## Worker bundle size over 1MB on deploy

Cloudflare's free tier caps bundles at 1MB post-gzip. `@solvapay/mcp` + `@solvapay/server` + `@modelcontextprotocol/sdk` sit close to this ceiling. Upgrade to the paid tier (10MB cap) if you need more headroom.

## `Already connected to a transport` errors under load

You removed `mode: 'json-stateless'`. Put it back; Workers isolates don't pin sessions across requests.

## Tool calls succeed locally but fail from a browser MCP client

(ChatGPT Custom Connectors, Inspector web UI.) The browser-origin CORS helpers in `worker.ts` are what make this work. Don't remove `applyBrowserCors` or `browserCorsPreflight` — see [widget-templates-config.md](widget-templates-config.md#srcworkerts).

## Widget flashes empty on every silent tool success

You set `_meta.ui.resourceUri` on a merchant payable tool. Remove it; `resourceUri` belongs only on the three SolvaPay intent tools, which `createSolvaPayMcpFetch` registers for you.

## Gate returns a structured UI payload instead of text

You hand-rolled a paywall response or wrapped a virtual tool with `payable.mcp()`. Use `registerPayable` and let it emit the text-only narration.

## Widget doesn't mount when I call `upgrade`

Verify the MCP host supports iframe resources (Claude Desktop, ChatGPT Apps, MCP Inspector do; pure terminal clients don't). On unsupported hosts the intent tool returns the bootstrap payload in `structuredContent` for programmatic use.
