# Out of scope for website-checkout

This skill covers hosted checkout + customer portal for web apps (Next.js fully, React partial). Stop here and use a different SolvaPay skill when the user needs:

| Need | Skill (install by name) |
| --- | --- |
| Usage metering, Express API paywall, MCP server wiring, webhooks-heavy SDK flows | `sdk-integration` |
| Paid MCP server scaffold (OpenAPI / greenfield Workers) | `create-mcp-app` |
| Lovable / Vite + Supabase Edge preview checkout | `lovable-checkout` |
| Vague “add SolvaPay” with no clear surface | `solvapay` |

Install: `npx skills add solvapay/skills --skill <name> -y` (flat CLI name — e.g. `sdk-integration` for routing id `solvapay/sdk-integration`)

## Webhooks and metering (topics only)

If the user needs purchase sync via webhooks or metered billing beyond hosted checkout:

1. Resolve topics via docs: `webhooks`, `verify signature`, `track usage`, `limits`.
2. Docs sources: SolvaPay Docs MCP → https://docs.solvapay.com/llms.txt → direct page fetch.
3. Implement on the server with `@solvapay/server` helpers — never expose `SOLVAPAY_SECRET_KEY` client-side.

This skill does not include full webhook implementation steps; those belong in `sdk-integration` when that skill is installed.
