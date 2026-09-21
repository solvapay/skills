# Tool design for SolvaPay MCP apps

Intent-driven composition for paywalled MCP tools. Read this before writing any paid-tool registration. Syntax for the chosen language is in **one** file from the table below — never a second language file.

| Language | Paid | Free-capped | Unlimited free | Respond | File |
| --- | --- | --- | --- | --- | --- |
| TypeScript | `ctx.registerPayable(name, { schema, handler })` | `ctx.registerFree` (TypeScript only) | `ctx.server.registerTool` | `c.respond(data, { text })` | [languages/ts.md](languages/ts.md) |
| Python | `register_payable_tool(server, name, solvapay=, product=, handler=)` | — | host MCP server register | `ctx.respond(data, {"text": ...})` | [languages/python.md](languages/python.md) |
| Ruby | `engine.register_payable(name, product:, handler:)` | — | host MCP server register | `ctx.respond(data)` | [languages/ruby.md](languages/ruby.md) |
| Go | `srv.RegisterPayable(name, solvapaymcp.Options{...})` | — | host MCP server register | `rc.Respond(data, map[string]any{"text": ...})` | [languages/go.md](languages/go.md) |
| Rust | `server.register_payable(PayableTool{...}, handler, None)` | — | host MCP server register | `ctx.respond(json!(data), Some(json!({"text": ...})))` | [languages/rust.md](languages/rust.md) |

## Contents

- Core principle
- Three response modes
- Intent composition with recovery tools
- `_meta.ui.resourceUri` rule
- Artifact rendering on success
- Three tool kinds
- Hide transport tools from text hosts
- Annotations
- Slash-command prompts
- Tool-naming guardrails
- Anti-patterns

## Core principle

**Data-in, host-rendered-out.** Tools return data (text or `structuredContent`) regardless of domain. The host LLM decides presentation. Custom graphical widgets are an opt-in module: [mcp-apps-ui.md](mcp-apps-ui.md).

## Three response modes

Every paid or free-capped tool response is in one of three modes. Know which before writing code.

| Mode | When | Surface |
| --- | --- | --- |
| **Silent** | Merchant tool returned data, customer has balance / is within limits. | Data only. No iframe. |
| **Nudge** | Data returned *and* something is worth flagging. | Dismissible strip. Never blocks. |
| **Gate** | Data could not be returned (out of credits, or a `registerFree` allowance exhausted with `paywallReason: 'limit_reached'`). | **Text-only** narration in `content[0].text` naming the recovery intent. `structuredContent` carries a `gate` payload. The widget iframe does not auto-open. |

On a gate, the user (or LLM) reads the narration and decides whether to invoke a recovery intent tool. Only that deliberate invocation mounts the iframe.

## Intent composition with recovery tools

The factory registers these for free:

| Surface | Purpose |
| --- | --- |
| `account` | Read-only billing viewer. Optional `view: 'checkout' \| 'account' \| 'topup'`. Slash prompts `/upgrade`, `/manage_account`, `/topup` remap onto `account` with that `view`. |
| `activate_plan` | Activate a plan by `planRef`. Mutator only — no bootstrap payload, no `_meta.ui.resourceUri`. List plans via `account` with `view: "checkout"`. |

Paid and free-capped registration write the gate narration. They name `` `account` `` (or `` `activate_plan` `` when a `planRef` is known). You do not compose that narration.

UI transport tools (`create_hosted_session`, `set_renewal`, `get_history`, payment helpers) stay hidden from text hosts — see below.

## `_meta.ui.resourceUri` rule

Never set `_meta.ui.resourceUri` on merchant payable tools. SEP-1865 requires hosts to open the iframe on every advertised call, which flashes an empty widget on silent success. Paid registration does not accept `resourceUri`; do not work around it.

`_meta.ui.resourceUri` lives only on the `account` viewer. `activate_plan` is a mutator — no `resourceUri`.

## Artifact rendering on success

Put business data in `structuredContent` via the language's respond helper. Write narration as an explicit render instruction (table, card, list, chart). Programmatic consumers read the structured payload; the host LLM reads the text.

## Three tool kinds

Pick one registration API per tool. They are not interchangeable. **Free-capped (`registerFree`) is TypeScript-only.** Python, Ruby, Go, and Rust have paid + unlimited-free only.

| Kind | Register with (TypeScript) | Identity | Counting | Gate |
| --- | --- | --- | --- | --- |
| **Paid** | `ctx.registerPayable` | Required | Billable meter | Credits / plan |
| **Free-capped** | `ctx.registerFree` (TypeScript only) | **Required** | `free-*` meter, cap in code | `paywallReason: 'limit_reached'` |
| **Unlimited free** | `ctx.server.registerTool` | None | None | None |

`c.respond` is on the handler context for **paid and free-capped**. Unlimited-free handlers hand-roll `{ content, structuredContent }`. Mixing `c.respond` into a `registerTool` callback fails — that helper is not on that signature.

The highest-cost mix-up: **free-capped is not "free with no auth".** `registerFree` rejects unidentified callers with `401` / `identity_required`. There is no anonymous bucket. Unlimited-free (`registerTool`) is the only kind that skips identity.

### Paid (`ctx.registerPayable`)

Usage-based or plan-gated tools. The factory runs the paywall before your handler. Return `c.respond(data, { text: narration })`. Other languages: paid helper from the table at the top.

### Free-capped (`ctx.registerFree`) — TypeScript only

An otherwise-free tool with a per-customer cap declared next to the tool. Exhaustion uses the same paywall gate as paid. Requires `@solvapay/mcp@latest` (`@preview` only for `--dev` / api-dev). Do not invent `register_free` / `RegisterFree` on Python, Ruby, Go, or Rust.

Meter names must match `/^free-[a-z0-9-]+$/`. Omitting `meter` defaults to `free-requests`. Tools that name the same meter share one counter and **must** agree on `cap` / `scope` / `windowDays` or registration throws. Hand the same `limit` object to both.

```ts
const PREVIEW_ALLOWANCE = {
  meter: 'free-previews',
  cap: 5,
  scope: 'rolling_window' as const,
  windowDays: 30,
}

export function registerPreviewQuote(ctx: AdditionalToolsContext): void {
  const { registerFree } = ctx

  registerFree('preview_market_quote', {
    title: 'Preview quote',
    description: 'Price-only quote preview.',
    schema: { symbol: z.string().min(1) },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    limit: PREVIEW_ALLOWANCE,
    handler: async ({ symbol }, c) => {
      const data = await previewQuote(symbol)
      return c.respond(data, { text: `Preview for ${symbol}. Render as a compact quote card.` })
    },
  })
}
```

`scope` is `rolling_window` (pass `windowDays`) or `lifetime`. `registerFree(name, config)` takes **exactly two arguments**, same as `registerPayable`.

### Unlimited free (`ctx.server.registerTool`)

Public catalogue lookups, version pings, tools that must work with no auth and no counting. No gate, no usage event. The respond helper is not available. Still include render-instruction narration plus structured data.

```ts
ctx.server.registerTool(
  'list_categories',
  {
    title: 'List categories',
    description: 'Returns the merchant catalogue\'s top-level categories. Unlimited, no identity required.',
    inputSchema: { /* zod schema */ },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  },
  async (input) => {
    const data = await loadCategories()
    return {
      content: [
        {
          type: 'text',
          text: `Returned ${data.length} categories. Render as a vertical list grouped by parent.`,
        },
      ],
      structuredContent: { categories: data },
    }
  },
)
```

The narration in `content[0].text` plays the same role as the `text` field in `c.respond(...)`.

## Hide transport tools from text hosts

Pass the factory option that hides UI-only virtual tools from `tools/list`. TypeScript is the one row that must opt in explicitly: `hideToolsByAudience: ['ui']`. Go, Python, and Rust hide the `ui` audience by default (Rust's `McpHttpConfig` defaults `hide_audiences` to `["ui"]`; pass `Some(vec![])` to disable). Always hide unless you have a specific reason not to.

## Annotations

Every tool needs annotations. Payable / free-capped registration applies `{ readOnlyHint: true, openWorldHint: true }` when the language surface supports defaults. Override when needed:

- `readOnlyHint: false` + `destructiveHint: true` for create / update / delete
- `idempotentHint: true` for pure queries
- `openWorldHint: true` is always correct for paywalled tools

## Slash-command prompts

Optional. Hosts with prompt UI (Claude Desktop) can register a prompt per user-facing tool. Hosts without prompt support ignore them. See the language file for the register-prompt call if the scaffold includes one.

## Tool-naming guardrails

- Verbs first: `get_*`, `list_*`, `search_*`, `create_*`, `update_*`, `delete_*`, `analyze_*`, `predict_*`, `generate_*`
- One intent per tool. If the description has "or", split it
- Snake_case MCP names. No `mcp_` or company prefix
- `--tool-name` at scaffold time is the MCP identifier — pass snake_case

## Anti-patterns

- Do not wrap `account` / `activate_plan` with the payable helper. They are recovery tools.
- Do not hand-roll a paywall response or attach a custom iframe on the gate path.
- Do not run expensive handler logic and then check balance. The payable helper gates first.
- Do not depend on the widget mounting automatically for merchant tools.
- Do not skip annotations where the language surface accepts them.
- Do not register a capped preview with `ctx.server.registerTool` plus a hand-rolled counter. That is `registerFree` (TypeScript only).
- Do not treat `registerFree` as anonymous. Unidentified callers fail with `identity_required`.

**Wrong:** advertise `resourceUri` on a merchant tool; return an iframe on a gate; call upstream before the gate.

**Right:** payable registration + respond helper; gate narration names `account`; handler runs only on the happy path.
