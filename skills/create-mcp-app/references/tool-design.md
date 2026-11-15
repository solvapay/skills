# Tool Design for SolvaPay MCP Apps

The language-neutral contract for paywalled MCP tools. Read this before writing any tool, then read the one language file SKILL.md picked: [languages/ts.md](languages/ts.md), [languages/python.md](languages/python.md) or [languages/go.md](languages/go.md). The code lives there; the rules live here and hold in every language.

## Contents

- Core principle
- Three response modes
- Intent composition with recovery tools
- `_meta.ui.resourceUri` rule
- Respond with narration
- Three tool kinds
- Identity
- Hide transport tools from text hosts
- Annotations
- Tool-naming guardrails
- Anti-patterns

## Core principle

**Data-in, host-rendered-out.** Tools return data (text or `structuredContent`) regardless of domain — data, search, integrations, actions, computations, content — and the host LLM (Claude, ChatGPT, Cursor, MCP Inspector, …) decides how to present it. For the common case this is the whole surface. If a specific tool genuinely needs a custom graphical widget (TypeScript only), keep the server + paywall wiring from this skill and add the UI surface via [mcp-apps-ui.md](mcp-apps-ui.md).

## Three response modes

Every paid or free-capped tool response is in one of three modes. Know which before writing code.

| Mode | When | Surface |
| --- | --- | --- |
| **Silent** | The merchant's tool returned data, the customer is within limits. The common case. | Data only. No iframe, no card, no upsell. |
| **Nudge** | Data returned *and* something is worth flagging (low balance, cycle ending, approaching limit). | A soft prompt after the answer. Never blocks. |
| **Gate** | Data could *not* be returned: out of credits, needs to upgrade, or a free allowance is used up (`paywallReason: 'limit_reached'`). | **Text-only** narration in `content[0].text` naming the recovery tool. `structuredContent` carries the gate with `checkoutUrl` for programmatic consumers. **The widget iframe does not auto-open.** |

On a gate, the user (or LLM) reads the narration and decides whether to call a recovery tool. Only that deliberate call mounts the iframe. This is the non-intrusive contract — do not work around it.

## Intent composition with recovery tools

Every SolvaPay MCP server ships two built-in recovery tools, in all three SDKs:

| Tool | Purpose |
| --- | --- |
| `account` | Read-only billing viewer. Optional `view: 'checkout' \| 'account' \| 'topup'`; omit it and the server picks. Mounts the checkout, account or top-up widget on hosts that render MCP Apps; text with links elsewhere. Slash prompts `/upgrade`, `/manage_account` and `/topup` remap onto it. |
| `activate_plan` | Activates a plan by `planRef`. A mutator only — no widget. To list plans, call `account` with `view: "checkout"`. |

The SDK's paid and free-capped registration writes the gate narration for you, naming `account` with the right `view` (or `activate_plan` when a `planRef` is known). You don't compose it.

## `_meta.ui.resourceUri` rule

Never set `_meta.ui.resourceUri` on a merchant tool. Per SEP-1865, hosts MUST open the iframe on every call when a tool advertises it, which flashes an empty widget on every silent success. `_meta.ui.resourceUri` lives only on the `account` tool, where calling it is the user's explicit intent to open the UI.

## Respond with narration

Paid and free-capped handlers answer through the SDK's respond helper (a `respond(data, text)` call in each language). Put the business data in `data` (it becomes `structuredContent`) and write `text` as an explicit render instruction, so capable hosts present it well:

> `Returned 12 matching items. Render this as a table with columns: name, price, stock. Show the total at the bottom.`

The host LLM reads the narration to choose a table, card, list or chart; `structuredContent` carries the raw data for programmatic consumers. Never return a hand-built `content` array from a paid or free-capped handler.

## Three tool kinds

Pick one registration per tool. They are not interchangeable.

| Kind | Identity | Counting | Gate |
| --- | --- | --- | --- |
| **Paid** | Required | Billable meter | Credits / plan |
| **Free-capped** | **Required** | `free-*` meter, cap declared in code | `paywallReason: 'limit_reached'` |
| **Uncounted free** | See Identity | None | None |

- **Paid**: usage-based or plan-gated tools. The SDK runs the paywall **before** your handler; the handler only runs on the happy path.
- **Free-capped**: an otherwise-free tool with a per-customer cap declared next to it. Exhaustion uses the same gate as paid. The meter name matches `free-[a-z0-9-]+` (default `free-requests`). Tools naming the same meter share one counter and must declare the same cap, scope and window, or registration fails. `scope` is `rolling_window` (with a window in days) or `lifetime`.
- **Uncounted free**: public catalogue lookups, version pings. Registered on the underlying MCP server, not through SolvaPay. The narration principle still applies: put a render instruction in `content[0].text` and the data in `structuredContent`.

The highest-cost mix-up: **free-capped is not "free with no auth".** Unidentified callers fail with `identity_required`. There is no anonymous bucket.

## Identity

- Paid and free-capped tools always need a customer. The SDK takes it from the bearer token SolvaPay verified, never from a tool argument.
- **TypeScript**: an uncounted tool registered on the underlying server skips identity.
- **Python and Go**: every request to `/mcp` needs a verified bearer token, so even uncounted tools are only reachable by a signed-in customer.
- Overriding the customer with your own verified auth is a per-language option (`get_customer_ref` in Python, `GetCustomerRef` in Go); never feed it an unverified value.

## Hide transport tools from text hosts

The SolvaPay widget calls transport tools (`create_payment_intent`, `process_payment`, `create_hosted_session`, …). They are marked for the app, so MCP Apps hosts keep them from the model. Set the SDK's hide-by-audience option to `["ui"]` for hosts that list them anyway; they stay callable, and ChatGPT still gets the full list because its widget can only call listed tools.

## Annotations

Every tool has annotations. Paid and free-capped registration defaults to `readOnlyHint: true, openWorldHint: true`. Override when needed:

- `readOnlyHint: false` + `destructiveHint: true` for state-changing tools (create, update, delete).
- `idempotentHint: true` for pure query tools.
- `openWorldHint: true` is always correct for paywalled tools — they talk to merchant and SolvaPay backends.

## Tool-naming guardrails

- Verbs first: `get_*`, `list_*`, `search_*`, `create_*`, `update_*`, `delete_*`, `analyze_*`, `predict_*`, `generate_*`.
- One clear intent per tool. If a tool's description has "or" in it, split it.
- snake_case, short, no `mcp_` or company prefix — the host shows the merchant's name alongside the tool.
- Say in the description what a call costs or how many free calls it has; the SDK appends the `account` hint.

## Anti-patterns

- Do not wrap `account` or `activate_plan` in a paywall. They are the recovery path, not paid business logic.
- Do not hand-roll a paywall response (custom iframe, `_meta.ui.*`, your own "please pay" text). The SDK's gate is the contract.
- Do not run expensive upstream work before the gate check, and do not re-order it: the SDK checks first, then calls your handler.
- Do not depend on the widget mounting "somewhere automatically". It mounts only on a deliberate `account` call.
- Do not skip annotations.
- Do not register a capped preview as an uncounted tool plus a hand-rolled counter. That is free-capped.
- Do not treat free-capped as anonymous.
- Do not take the customer from a tool argument or an unverified header.
- Do not send 64-bit integer IDs as plain JSON numbers: values above 2^53 are rounded and later calls hit the wrong record. Send them as strings.
