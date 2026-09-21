# Environment and Init

Plan-validate-execute for SDK setup before implementing routes.

## Init procedure

1. Run `npx -y solvapay@latest init` (authenticates, writes `SOLVAPAY_SECRET_KEY`, installs base packages).
2. Install stack-specific packages (`@solvapay/next`, `@solvapay/react`, etc.) if not added by init.
3. Confirm product and plans exist in SolvaPay Console.

## Env plan-validate-execute

1. **Plan:** List `SOLVAPAY_SECRET_KEY`, product refs, `SOLVAPAY_WEBHOOK_SECRET` (if webhooks), auth provider vars.
2. **Validate:** Run `node scripts/check-env.mjs` — no secrets in `NEXT_PUBLIC_*` / `VITE_*`.
3. **Execute:** Implement server routes.

## Required variables

| Variable | Where | Notes |
| --- | --- | --- |
| `SOLVAPAY_SECRET_KEY` | Server only | From `init` |
| `SOLVAPAY_API_BASE_URL` | Server optional | Override API host |
| `SOLVAPAY_WEBHOOK_SECRET` | Server | When webhooks enabled |

## Manual install fallback

When CLI cannot run (CI/restricted env):

```bash
npm install @solvapay/server @solvapay/next @solvapay/react @solvapay/auth @solvapay/react-supabase @supabase/supabase-js
```

## Deno import map (Supabase Edge)

```json
{
  "imports": {
    "@solvapay/server": "npm:@solvapay/server",
    "@solvapay/server/": "npm:/@solvapay/server/",
    "@solvapay/auth": "npm:@solvapay/auth",
    "@solvapay/core": "npm:@solvapay/core"
  }
}
```

Trailing slash on `@solvapay/server/` unlocks `/fetch` subpath imports.
