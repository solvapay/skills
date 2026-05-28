# Step 2: Authentication

Use Supabase JWT auth so server routes can map requests to one customer identity.

## Docs References (Topic-Based)

- Topics: `nextjs auth`, `supabase adapter`, `customer sync`.
- Retrieval hint: resolve via MCP/`llms.txt` and fetch only auth-relevant sections.

## Recommended Pattern

- Use SolvaPay Next auth middleware helper to extract user id for `/api/*`.
- Keep auth token handling server-side for all checkout/customer session routes.
- Use `SolvaPayProvider` + Supabase adapter in client UI layer.

## Implementation Notes

- Middleware should set a stable user identifier for downstream API handlers.
- Customer sync should run before first checkout for new users.
- Keep an access check route (for example `/api/check-access`) available for UI refresh after checkout return.

## Verify

- [ ] Unauthenticated requests to protected routes return 401
- [ ] Authenticated requests include stable user identity
- [ ] Customer sync endpoint can create/update customer mapping

## Troubleshooting

- Intermittent auth failures -> token not forwarded from client to API route.
- Customer session creation fails -> customer sync not executed or wrong customer ref.
