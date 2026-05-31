# Lovable Checkout — Troubleshooting and Sandbox

## Contents

- Sandbox verification
- Troubleshooting table
- Going stable (preview promotion)

## Sandbox verification

1. `supabase functions deploy` completes without import-map errors.
2. Sign in via Supabase auth; navigate to `/checkout` — plans appear.
3. Test card `4242 4242 4242 4242` → `onResult({ kind: 'paid' })` → dashboard.
4. Decline card `4000 0000 0000 0002` → UI surfaces decline without crash.
5. Fix failures using troubleshooting table below; re-test until pass.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `CheckoutLayout` missing from exports | Old pinned preview version | Use `"preview"` in package.json, reinstall |
| `/list-plans` returns `[]` | Wrong `VITE_SOLVAPAY_PRODUCT_REF` or no plans | Verify product ref and active plans in Console |
| `PurchaseGate` always `Blocked` after checkout | `requireProduct` name mismatch | Copy product **name** verbatim from Console |
| 402 with no checkout URL | Prod API with sandbox key | Set api-dev URL in edge secret, redeploy |
| CORS / 500 from functions | Secrets changed, not redeployed | `supabase functions deploy` |
| Unstyled primitives | CSS import order wrong | `@solvapay/react/styles.css` after `./index.css` |
| `useApp is not exported` | Wrong skill (MCP App UI) | Use `solvapay/sdk-integration` or `solvapay/create-mcp-app` |
| Deno wrong versions | Stale `deno.json` | Recreate import map per 01-edge-and-secrets.md |

## Going stable

<details>
<summary>When @preview promotes to @latest</summary>

1. Replace `"preview"` with stable version in `package.json`; reinstall.
2. Update `deno.json` to drop `@preview` suffixes.
3. Rotate `SOLVAPAY_API_BASE_URL` to `https://api.solvapay.com`.
4. Rotate `SOLVAPAY_SECRET_KEY` to `sk_live_...`.
5. For production Next.js or full SDK flows, use `solvapay/website-checkout` or `solvapay/sdk-integration`.

</details>
