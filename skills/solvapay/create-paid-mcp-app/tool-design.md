# Tool Design for SolvaPay MCP Apps

Intent-driven composition for paywalled MCP tools. Read this before writing any `registerPayable(...)` call.

## Contents

- Core principle
- Three response modes
- Intent composition with recovery tools
- `_meta.ui.resourceUri` rule
- Artifact rendering on success
- Hide transport tools from text hosts
- Annotations
- Slash-command prompts
- Tool-naming guardrails
- Wiring into the server
- Anti-patterns

## Core principle

**Data-in, host-rendered-out.** Tools return data (text or `structuredContent`) regardless of domain — data, search, integrations, actions, computations, content — and the host LLM (Claude, ChatGPT, Cursor, MCP Inspector, …) decides how to present it. For the common case this is the whole surface — stay here. If a specific tool genuinely needs a custom graphical widget, keep the server + paywall wiring from this skill and add the UI surface via [../sdk-integration/mcp-server/guide.md](../sdk-integration/mcp-server/guide.md) + [../sdk-integration/react/guide.md](../sdk-integration/react/guide.md).

## Three response modes

Every paid tool response is in one of three modes. Know which before writing code.

| Mode | When | Surface |
| --- | --- | --- |
| **Silent** | Merchant's tool returned data, customer has balance. The common case. | Data only. No iframe, no card, no upsell. |
| **Nudge** | Data returned *and* something is worth flagging (low balance, cycle ending, approaching limit). | Dismissible inline strip. Never blocks. |
| **Gate** | Data could *not* be returned. Customer is out of credits or needs to upgrade. | **Text-only** narration in `content[0].text` naming the recovery intent tool. `structuredContent` carries a `gate` payload with `checkoutUrl` for programmatic consumers. **The widget iframe does not auto-open.** |

On a gate, the user (or LLM) reads the narration and decides whether to invoke a recovery intent tool. Only that deliberate invocation mounts the iframe. This is the non-intrusive contract — do not work around it.

## Intent composition with recovery tools

Every paid business tool pairs with the built-in recovery intents, which ship for free from `@solvapay/mcp` when you use `createSolvaPayMcpFetch` / `createSolvaPayMcpServer` / `createSolvaPayMcpExpress`:

| Intent tool | Purpose |
| --- | --- |
| `upgrade` | Plan change or initial purchase. Mounts the checkout widget. |
| `topup` | Add credits to a usage-based plan. Mounts the topup widget. |
| `activate_plan` | Activate a free or included plan without checkout. |
| `manage_account` | Open the customer portal: cancel, switch plan, update card. |

`registerPayable` writes the gate narration for you; it names the correct recovery tool based on the customer's state (no balance -> `topup` or `upgrade`; no active plan -> `activate_plan` or `upgrade`). You don't compose the narration yourself.

## `_meta.ui.resourceUri` rule

Never set `_meta.ui.resourceUri` on merchant payable tools. Per SEP-1865, hosts MUST open the iframe on every call when a tool advertises this — which flashes an empty widget on every silent success. `registerPayable` deliberately does not accept `resourceUri`; don't work around it by calling the lower-level `registerPayableTool` with it either.

`_meta.ui.resourceUri` lives only on the three SolvaPay intent tools (`upgrade`, `manage_account`, `topup`), where calling them is the user's explicit intent to open the UI.

## Artifact rendering on success

For successful calls, put business data in `structuredContent` via `ctx.respond(payload, { text: narration })`. Write the narration as an explicit render instruction so capable hosts (Claude artifacts, ChatGPT Apps) present the data well:

```ts
return ctx.respond(
  { items, total, currency: 'USD' },
  {
    text: `Returned ${items.length} matching items. Render this as a table with columns: name, price, stock. Show the total at the bottom.`,
  },
)
```

The host LLM reads the narration to decide presentation (table, card, list, chart), and the `structuredContent` carries the raw data for programmatic consumers.

## Hide transport tools from text hosts

`createSolvaPayMcp*({ hideToolsByAudience: ['ui'] })` drops UI-only virtual tools (`create_checkout_session`, `process_payment`, …) from `tools/list` so text-only hosts don't reason about iframe transport tools meant for the embedded widget. Always set this unless you have a specific reason not to.

## Annotations

Every tool must have annotations. `registerPayable` applies `{ readOnlyHint: true, openWorldHint: true }` by default. Override when needed:

- `readOnlyHint: false` + `destructiveHint: true` for state-mutating tools (create, update, delete).
- `idempotentHint: true` for pure query tools.
- `openWorldHint: true` is always correct for paywalled tools — they talk to merchant and SolvaPay backends.

## Slash-command prompts

Optional. For hosts with prompt UI (Claude Desktop slash commands), register a prompt per user-facing tool so the tool is discoverable from the host chrome:

```ts
server.registerPrompt(
  'search_items',
  {
    title: 'Search items',
    description: 'Search the merchant catalog. 1 credit per call.',
    argsSchema: { query: z.string().optional() },
  },
  async ({ query }) => ({
    messages: [
      {
        role: 'user',
        content: { type: 'text', text: `Search items matching "${query ?? ''}" and render the top results as a table.` },
      },
    ],
  }),
)
```

Hosts without prompt support silently ignore these — purely additive.

## Tool-naming guardrails

- Verbs first: `get_*`, `list_*`, `search_*`, `create_*`, `update_*`, `delete_*`, `analyze_*`, `predict_*`, `generate_*`.
- One clear intent per tool. No overloading. If a tool's description has "or" in it, split it.
- Match the SolvaPay tool surface's verb style. `get_user_info` not `userInfo`; `list_items` not `items`.
- Keep names short and lowercased with underscores. Avoid prefixes like `mcp_` or your company name — the host shows the merchant's name alongside the tool.

## Wiring into the server

Register your paid tools by passing an `additionalTools` callback to the factory:

```ts
import { z } from 'zod'
import type { AdditionalToolsContext } from '@solvapay/mcp'

export function registerMyTools(ctx: AdditionalToolsContext): void {
  const { registerPayable } = ctx

  registerPayable('get_item', {
    title: 'Get item',
    description:
      'Returns the requested item. 1 credit per call; when the customer is out of balance, returns a text-only purchase-required narration naming the `upgrade` or `topup` recovery tool — the widget iframe does not auto-open.',
    schema: { id: z.string().min(1) },
    annotations: { readOnlyHint: true, idempotentHint: true },
    handler: async ({ id }, ctx) => {
      const data = await loadItem(id)
      const narration = `Item ${id}: ${summarize(data)}. Render as a card with the key fields.`
      return ctx.respond(data, { text: narration })
    },
  })
}
```

Then in the server factory call:

```ts
createSolvaPayMcpFetch({
  solvaPay,
  productRef,
  resourceUri: 'ui://your-worker/mcp-app.html',
  readHtml: async () => mcpAppHtml,
  publicBaseUrl,
  apiBaseUrl,
  mode: 'json-stateless',
  hideToolsByAudience: ['ui'],
  additionalTools: registerMyTools,
})
```

For Cloudflare Workers, the full server template is in [hosting/cloudflare.md](hosting/cloudflare.md). For other runtimes, see [hosting/alternatives.md](hosting/alternatives.md).

## Anti-patterns

- Do not wrap `upgrade` / `topup` / `manage_account` / `activate_plan` / `check_purchase` with `payable.mcp()`. They are recovery tools, not paid business logic.
- Do not hand-roll a paywall response. `registerPayable` emits the correct text-only gate narration — adding your own `_meta.ui.*` / `McpPaywallView` / custom iframe defeats the non-intrusive contract.
- Do not return data from a gated call by running the handler first and then checking balance. `registerPayable` runs the gate check before your handler — don't re-order it.
- Do not depend on the widget mounting "somewhere automatically" for merchant tools. The widget is only for the three intent tools; merchant tools always return data.
- Do not skip annotations. `readOnlyHint` / `destructiveHint` / `idempotentHint` / `openWorldHint` are required, not optional.
