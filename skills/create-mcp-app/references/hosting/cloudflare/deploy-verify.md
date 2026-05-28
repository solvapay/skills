# Cloudflare Workers — Deploy + Verify (Steps 8-9)

Continues from [setup.md](setup.md). Templates: [widget-templates-config.md](widget-templates-config.md), [widget-templates-widget-and-scripts.md](widget-templates-widget-and-scripts.md). For common failure modes see [troubleshooting.md](troubleshooting.md).

## Step 8 — Deploy

```bash
pnpm run deploy
```

This runs `scripts/deploy.mjs`, which sources your local `.env` and forwards `SOLVAPAY_PRODUCT_REF` / `MCP_PUBLIC_BASE_URL` / `SOLVAPAY_API_BASE_URL` as `--var` overrides to `wrangler deploy`. `SOLVAPAY_SECRET_KEY` is deliberately **not** re-uploaded — it lives in the Cloudflare secret store from Step 5 of [setup.md](setup.md).

Verify:

```bash
curl https://<your-host>/.well-known/oauth-authorization-server
```

## Step 9 — Gate smoke test

In the SolvaPay sandbox, exhaust a test customer's balance by calling one of your paid tools repeatedly until gated. Confirm the gated response shape:

- `content[0].text` is a plain-text `Purchase required` narration naming the correct recovery tool (`upgrade` / `topup` / `activate_plan`).
- `structuredContent` carries a `gate` payload with `checkoutUrl`.
- **No iframe mounts** on the gate.

Then invoke the named recovery tool (e.g. `upgrade`) from the MCP client and confirm the widget mounts. This verifies the non-intrusive gate contract end-to-end.
