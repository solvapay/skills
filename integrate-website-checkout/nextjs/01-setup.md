# Step 1: Setup

## Docs References (Topic-Based)

- Topics: `installation`, `nextjs guide`, `core concepts`.
- Retrieval hint: resolve via MCP first; fallback to `llms.txt`.

## Required Packages

```bash
npm install @solvapay/server@preview @solvapay/next@preview @solvapay/react@preview @solvapay/auth@preview @solvapay/react-supabase@preview @supabase/supabase-js
```

## Environment Variables

```env
SOLVAPAY_SECRET_KEY=sp_...
SOLVAPAY_API_BASE_URL=https://api.solvapay.com
NEXT_PUBLIC_PRODUCT_REF=prd_...
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_JWT_SECRET=...
```

## Purpose of Variables

- `SOLVAPAY_SECRET_KEY`: server-only auth to Solvapay API
- `SOLVAPAY_API_BASE_URL`: optional API host override
- `NEXT_PUBLIC_PRODUCT_REF`: default product used for hosted checkout
- Supabase vars: auth and token verification

## Verify

- [ ] App Router project is present
- [ ] Server env vars exist
- [ ] No secret values in `NEXT_PUBLIC_*`
- [ ] Product reference exists in Solvapay dashboard

## Troubleshooting

- Missing env errors -> ensure `.env.local` exists and restart dev server.
- 401 on all API routes -> verify JWT secret and auth middleware setup in next step.
