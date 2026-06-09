---
name: lovable-checkout
description: >
  Load when someone is adding SolvaPay to a Lovable app or Vite+Supabase project — especially when
  they want to install @solvapay/react-supabase @preview packages, paste checkout code into Lovable
  chat, wire Supabase edge function secrets, or use api-dev.solvapay.com. Also triggers for:
  keeping SOLVAPAY_SECRET_KEY out of VITE_ env vars, setting up SolvaPayProvider, or getting a
  paywall running on Lovable fast. This skill handles the full setup: @preview package install,
  edge function templates, provider wiring, and sandbox testing. Skip for Next.js projects,
  production solvapay.com deployments, MCP server setup, or general "which SolvaPay product"
  questions.
metadata:
  version: "1.0.0"
compatibility: >
  Requires Lovable, Vite, shadcn/ui, and Supabase Edge Functions. Pinned to @preview
  and api-dev.solvapay.com — not for production.
---

# Lovable Checkout (preview)

Paste-in SolvaPay hosted checkout for Lovable (Vite + shadcn/ui + Supabase Edge). Designed to paste reference content into Lovable chat on turn zero.

## Guardrails

- **Never** put `SOLVAPAY_SECRET_KEY` in `.env`, `VITE_*`, or browser-reachable files — Supabase edge secrets only.
- **Never** hand-roll browser `fetch` to SolvaPay API — all backend calls through edge functions.
- **Always** install `@solvapay/react@preview` and `@solvapay/react-supabase@preview` — never pin exact preview versions.
- **Always** set `SOLVAPAY_API_BASE_URL=https://api-dev.solvapay.com` as edge secret.
- Not for production.

Full guardrails for paste-in: [references/01-edge-and-secrets.md](references/01-edge-and-secrets.md).

## Gotchas

- Secret in `.env` or `VITE_*` breaks security — edge secrets only (details: `01-edge-and-secrets.md`).
- Pinning exact preview version breaks exports — use `@preview` tag only.
- Multiple GoTrueClient instances cause auth bugs — singleton pattern (details: `02-provider-and-routes.md`).
- `@solvapay/react/styles.css` must import **after** `./index.css` (details: `03-troubleshooting-and-sandbox.md`).
- `requireProduct` name must match Console product name exactly (details: `03-troubleshooting-and-sandbox.md`).
- MCP App UI errors mean wrong skill — use `solvapay/sdk-integration` or `solvapay/create-mcp-app`.

## Mandatory read order

Read in order before generating code:

0. [references/GUIDE.md](references/GUIDE.md) — index; then read the numbered files below
1. [references/01-edge-and-secrets.md](references/01-edge-and-secrets.md)
2. [references/02-provider-and-routes.md](references/02-provider-and-routes.md)
3. [references/03-troubleshooting-and-sandbox.md](references/03-troubleshooting-and-sandbox.md)

Load [references/REFERENCE.md](references/REFERENCE.md) when adding billing UI beyond CheckoutLayout or when Stripe/CSP issues persist.

Paste-in tip: concatenate all three reference files into Lovable chat for turn-zero bias.

## Integration procedure

1. Read all reference files in mandatory read order.
2. Install `@preview` packages via Deno one-liners in `01-edge-and-secrets.md`.
3. Create edge functions + Supabase secrets.
4. Wire `SolvaPayProvider` + routes per `02-provider-and-routes.md`.
5. Gate content from server truth.
6. Run verification loop.

## Edge plan-validate-execute

1. **Plan:** List edge functions + required secrets from templates in `01-edge-and-secrets.md`.
2. **Validate:** Run `node scripts/check-import-map.mjs`; confirm no secret in `VITE_*` / `.env`.
3. **Execute:** Deploy functions and wire provider.

## Verification loop

1. Complete edge setup and provider wiring.
2. Sandbox redirect → return URL → access granted.
3. On failure → consult troubleshooting table in `03-troubleshooting-and-sandbox.md` → fix → repeat until pass.

## Handoff template

```markdown
## Lovable checkout handoff
- **Edge functions:** [names]
- **Secrets set:** [list names, no values]
- **Routes:** [checkout / portal / gate]
- **Sandbox:** [redirect + return URL outcome]
- **Preview pin:** @preview (not production)
```

## Scripts

| Script | Action | Purpose |
| --- | --- | --- |
| `scripts/check-import-map.mjs` | **Run** | Validate Deno import map for @preview packages |

## Task progress

- [ ] Read GUIDE.md index → 01-edge-and-secrets → 02-provider-and-routes → 03-troubleshooting
- [ ] Run Deno install one-liners (@preview packages)
- [ ] Create edge functions from templates
- [ ] Set Supabase edge secrets
- [ ] Wire SolvaPayProvider + checkout/portal routes
- [ ] Gate premium content from server truth
- [ ] Run verification loop until pass

## References

- Edge + secrets: [references/01-edge-and-secrets.md](references/01-edge-and-secrets.md)
- Provider + routes: [references/02-provider-and-routes.md](references/02-provider-and-routes.md)
- Troubleshooting + sandbox: [references/03-troubleshooting-and-sandbox.md](references/03-troubleshooting-and-sandbox.md)
- Package map: [references/REFERENCE.md](references/REFERENCE.md)
