# Tool design for SolvaPay MCP apps

Intent-driven composition for paywalled MCP tools. Read this before writing any paid-tool registration. Syntax for the chosen language is in **one** file from the table below — never a second language file.

| Language | Registration | Respond | File |
| --- | --- | --- | --- |
| TypeScript | `ctx.registerPayable(name, { schema, handler })` | `c.respond(data, { text })` | [languages/ts.md](languages/ts.md) |
| Python | `register_payable_tool(server, name, solvapay=, product=, handler=)` | `ctx.respond(data, {"text": ...})` | [languages/python.md](languages/python.md) |
| Ruby | `engine.register_payable(name, product:, handler:)` | `ctx.respond(data)` | [languages/ruby.md](languages/ruby.md) |
| Go | `srv.RegisterPayable(name, solvapaymcp.Options{...})` | `rc.Respond(data, map[string]any{"text": ...})` | [languages/go.md](languages/go.md) |
| Rust | `server.register_payable(PayableTool{...}, handler, None)` | `ctx.respond(json!(data), Some(json!({"text": ...})))` | [languages/rust.md](languages/rust.md) |

## Contents

- Core principle
- Three response modes
- Intent composition with recovery tools
- `_meta.ui.resourceUri` rule
- Artifact rendering on success
- Free-tier tools
- Hide transport tools from text hosts
- Annotations
- Slash-command prompts
- Tool-naming guardrails
- Anti-patterns

## Core principle

**Data-in, host-rendered-out.** Tools return data (text or `structuredContent`) regardless of domain. The host LLM decides presentation. Custom graphical widgets are an opt-in module: [mcp-apps-ui.md](mcp-apps-ui.md).

## Three response modes

| Mode | When | Surface |
| --- | --- | --- |
| **Silent** | Merchant tool returned data, customer has balance. | Data only. No iframe. |
| **Nudge** | Data returned *and* something is worth flagging. | Dismissible strip. Never blocks. |
| **Gate** | Data could not be returned. | **Text-only** narration in `content[0].text` naming the recovery intent. `structuredContent` carries a `gate` payload. The widget iframe does not auto-open. |

## Intent composition with recovery tools

The factory registers these for free:

| Surface | Purpose |
| --- | --- |
| `account` | Read-only billing viewer. Optional `view: 'checkout' \| 'account' \| 'topup'`. Slash prompts `/upgrade`, `/manage_account`, `/topup` remap onto `account` with that `view`. |
| `activate_plan` | Activate a plan by `planRef`. Mutator only — no bootstrap payload, no `_meta.ui.resourceUri`. List plans via `account` with `view: "checkout"`. |

Paid registration writes the gate narration. It names `` `account` `` (or `` `activate_plan` `` when a `planRef` is known). You do not compose that narration.

UI transport tools (`create_hosted_session`, `set_renewal`, `get_history`, payment helpers) stay hidden from text hosts — see below.

## `_meta.ui.resourceUri` rule

Never set `_meta.ui.resourceUri` on merchant payable tools. SEP-1865 requires hosts to open the iframe on every advertised call, which flashes an empty widget on silent success. Paid registration does not accept `resourceUri`; do not work around it.

`_meta.ui.resourceUri` lives only on the `account` viewer. `activate_plan` is a mutator — no `resourceUri`.

## Artifact rendering on success

Put business data in `structuredContent` via the language's respond helper. Write narration as an explicit render instruction (table, card, list, chart). Programmatic consumers read the structured payload; the host LLM reads the text.

## Free-tier tools

Some tools are not paid — catalogue reads, status pings. Register them on the underlying MCP server, not the payable helper. The respond helper is not available there. Still include render-instruction narration plus structured data.

## Hide transport tools from text hosts

Pass the factory option that hides UI-only virtual tools from `tools/list` (`hideToolsByAudience: ['ui']` on TypeScript; the other language factories hide them by default). Always hide unless you have a specific reason not to.

## Annotations

Every tool needs annotations. Payable registration applies `{ readOnlyHint: true, openWorldHint: true }` when the language surface supports defaults. Override when needed:

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

**Wrong:** advertise `resourceUri` on a merchant tool; return an iframe on a gate; call upstream before the gate.

**Right:** payable registration + respond helper; gate narration names `account`; handler runs only on the happy path.
