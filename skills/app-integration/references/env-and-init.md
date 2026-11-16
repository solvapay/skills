# Environment and Init

Plan-validate-execute for SDK setup before implementing routes.

## Init procedure

1. **Product first.** Ask the user which SolvaPay product this app bills, and pass it: `--product prd_…`. Without a terminal (you are an agent), init never picks a product: it lists the account's products with their refs and leaves `SOLVAPAY_PRODUCT_REF` unset, and the app won't start without it. Show the user that list and ask; never pick one yourself. If none fits, the user creates one (with its plan) at https://app.solvapay.com/products, then rerun `npx -y solvapay@latest init --product prd_…`.
2. Run `npx -y solvapay@latest init` (authenticates, writes `SOLVAPAY_SECRET_KEY`, installs base packages). It detects the language (`go.mod` → Go; `uv.lock` / `poetry.lock` / `pyproject.toml` / `requirements.txt` → Python; `package.json` → TypeScript); pass `--language ts|python|go` to choose, and always for Python and Go. Python with uv or Poetry gets an exact pin via `uv add` / `poetry add`; plain pip gets only a printed `python -m pip install 'solvapay[<features>]==<version>'` line (extras from `--features`) to run yourself; Go gets `go get github.com/solvapay/solvapay-sdk/go@<version>`. Two languages in one folder with no terminal, or an empty folder, fails asking for `--language`; Python or Go in an empty folder asks for `uv init` / `go mod init` first.
3. Install stack-specific packages (`@solvapay/next`, `@solvapay/react`, etc.) if not added by init.
4. Confirm the product's plans in SolvaPay Console: the price per call comes from the plan, not from code.

## Customer identity

Every paid call needs a stable id for the customer, from the app's own verified auth (session, JWT, API key it already issues). It becomes the SolvaPay customer's `externalRef`.

**If the app has no auth, stop and ask the user** how callers are identified. Don't invent a scheme and don't read the id from a request header, query string or body: anyone can send another customer's id and charge their account. Offer the options: the auth the app is about to get, API keys the user issues per customer, or SolvaPay's agent payments for agent callers ([agent-payments.md](agent-payments.md)). Build the paywall only once identity is settled.

## Env plan-validate-execute

1. **Plan:** List `SOLVAPAY_SECRET_KEY`, product refs, `SOLVAPAY_WEBHOOK_SECRET` (if webhooks), auth provider vars.
2. **Validate:** Run `node scripts/check-env.mjs` — no secrets in `NEXT_PUBLIC_*` / `VITE_*`.
3. **Execute:** Implement server routes.

## Required variables

| Variable | Where | Notes |
| --- | --- | --- |
| `SOLVAPAY_SECRET_KEY` | Server only | From `init` |
| `SOLVAPAY_PRODUCT_REF` | Server | From `init --product prd_…`; required |
| `SOLVAPAY_API_BASE_URL` | Server optional | Override API host |
| `SOLVAPAY_WEBHOOK_SECRET` | Server | When webhooks enabled |

## Manual install fallback

Python: `uv add 'solvapay[web]'` (or the pip line above). Go: `go get github.com/solvapay/solvapay-sdk/go@latest && go mod tidy`. TypeScript:

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
