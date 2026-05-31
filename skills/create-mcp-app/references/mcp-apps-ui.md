# MCP Apps UI (custom graphical widgets)

Add custom React UI inside MCP host sandboxes (Claude Desktop, ChatGPT Apps, MCP Inspector) on top of the server + paywall wiring from this skill.

## When to use

- The host supports MCP Apps / iframe UI.
- You need graphical widgets for **your own** tools beyond SolvaPay's built-in checkout / account / topup widget.

Do **not** set `_meta.ui.resourceUri` on merchant payable tools — see [tool-design.md](tool-design.md). The built-in widget mounts only on deliberate intent-tool calls (`upgrade`, `topup`, `manage_account`).

## Server (unchanged)

Keep `createSolvaPayMcpFetch` / `registerPayable` wiring from [mcp-server-wiring.md](mcp-server-wiring.md) or [existing-server.md](existing-server.md). CSP for Stripe Elements in iframes is auto-injected by the factory.

## Client packages

```bash
npm install @solvapay/react
```

## SolvaPayProvider in the host sandbox

```tsx
import { SolvaPayProvider } from '@solvapay/react'
import { createMcpAppAdapter } from '@solvapay/react/mcp'
```

- Wrap the MCP app root with `SolvaPayProvider`.
- Pass `config.transport` from `createMcpAppAdapter` when running inside an MCP host iframe. SDK 1.1+ — `config.transport` is the only supported shape (per-method transport props on the provider were removed).

`createMcpAppAdapter` wires the host postMessage transport so checkout and account calls reach your server without browser `fetch` to SolvaPay APIs.

## Account management components

Drop into authenticated MCP app views:

- **`<CurrentPlanCard />`** — active plan, billing line, mirrored card, Update card / Cancel plan.
- **`<LaunchCustomerPortalButton />`** — hosted customer portal (pre-fetches session on hover).
- **`usePaymentMethod()`** — `{ kind: 'card', brand, last4, ... } | { kind: 'none' }`.
- **`useMerchant()`** — merchant branding for checkout copy.

## Backend requirement

The MCP server must expose SolvaPay tool surface + OAuth; the React bundle runs in the host sandbox only. Never put `SOLVAPAY_SECRET_KEY` in the widget bundle.

## Examples

- [`mcp-checkout-app`](https://github.com/solvapay/solvapay-sdk/tree/main/examples/mcp-checkout-app)

## Verification

- [ ] Provider initializes without secrets in client bundle
- [ ] `config.transport` set via `createMcpAppAdapter`
- [ ] Intent tools mount built-in widget; custom tool UI uses separate resource URIs per host docs
