---
name: pay-with-solvapay
description: >
  Use when a call to an API or MCP tool returns a SolvaPay paywall: HTTP 402 with a checkoutUrl,
  a tool result saying a plan, credits or activation is required, or a paywallReason such as
  activation_required, topup_required, payment_required or limit_reached. Also use when your user
  asks how to pay for, upgrade or keep funding a service that uses SolvaPay, or wants you to be able
  to pay for services yourself. Explains what each refusal means, which built-in account tools to
  call, what to tell your user, and how to request buy-side early access. Skip when you are building
  payments into your own API or MCP server (use the solvapay router).
metadata:
  version: "1.0.0"
---

# Pay with SolvaPay

SolvaPay is the payment layer behind many APIs and MCP servers. When one of them refuses a call for payment reasons, the refusal comes from SolvaPay on the merchant's behalf. This skill tells you how to recognise it and get your user unblocked.

## Rules

1. **Stop on a paywall.** Do not retry the same call, switch to another endpoint to get around it, or make up the result. A paywall is not a transient error.
2. **The human pays.** Never enter card details, passwords or bank details. Give your user the link; they complete checkout or top-up in the browser.
3. **Say what it costs and why.** Quote the merchant's message, name the plan or amount if the response gives one, and give the link.
4. **Retry once after the user confirms they paid.** If it is still refused, report the new response rather than looping.

## Recognising a SolvaPay paywall

**HTTP API:** status `402` with a JSON body like:

```json
{ "success": false, "error": "Payment required", "product": "prd_…", "checkoutUrl": "https://…", "message": "…" }
```

**MCP tool:** the result is not an error (`isError: false`). The text in `content[0].text` explains the block, and `structuredContent` carries the gate. A Managed MCP server may answer with text such as "Access denied - requires Pro plan".

**The reason, when given (`paywallReason`):**

| Reason | Meaning | What to do |
|---|---|---|
| `activation_required` | Your user has no plan with this merchant yet | Call `activate_plan` if the server has it. Free and usage-based plans activate at once. Otherwise give the checkout link |
| `topup_required` | Usage-based plan, credits used up | Open the `account` tool with `view: "topup"`, or give the top-up link |
| `payment_required` | The plan needs checkout before it is active | Give the `checkoutUrl` and wait for your user |
| `limit_reached` | The included allowance or free allowance is used up | Offer an upgrade (`upgrade_plan` or `account` with `view: "checkout"`), or wait for the next period |
| `identity_required` (HTTP 401) | The merchant does not know who your user is | Have your user sign in. MCP clients run the OAuth flow when the server asks |

## Account tools on SolvaPay MCP servers

Servers built on SolvaPay add tools for this. Use the ones the server lists:

- `account`: shows your user's account. Pass `view: "checkout"`, `"topup"` or `"account"` to open that page.
- `activate_plan`: activates a plan for your user.
- On Managed MCP servers:
  - `get_user_info` shows the plan, status, and quota used and remaining;
  - `upgrade_plan` lists plans with prices and checkout links;
  - `manage_purchase` returns the billing portal link.

Check `get_user_info` or `account` before a long run of paid calls, so you can warn your user before the quota runs out instead of being stopped halfway.

## Keeping a service funded

Credits are bought per merchant. If the merchant offers automatic top-up, your user can switch it on when they top up. SolvaPay then recharges from their saved card when the balance falls below a threshold, up to a monthly cap they set. Suggest it when your user expects you to keep calling a usage-based service unattended.

## When your user wants you to pay for services yourself

SolvaPay's buy side is coming: one account through which your user's agents spend inside limits the account owner sets, with an ID, a budget and an approval path for each agent. The card stays with your user. It is not open for self-serve sign-up yet, so you cannot get spending ability from SolvaPay today.

1. Tell your user the buy side is in early access.
2. Point them to the early-access form at https://solvapay.com/pay#early-access: a short form with their name, work email, company and, optionally, what their agents buy. The team sets up the account with them.
3. Let your user fill in the form themselves. Do not submit it for them.

Until then, pay per merchant as above.

## What to tell your user

> "[Service] needs [a plan / more credits] to continue: [merchant's message]. You can [subscribe / top up] here: [link]. Tell me when it's done and I'll pick up where I left off."

## Docs source

If a response does not match what is described here, look it up rather than guessing: SolvaPay Docs MCP (`https://docs.solvapay.com/mcp`, HTTP transport, no auth) → https://docs.solvapay.com/llms.txt → a direct page fetch. The paywall, plan activation and Managed MCP virtual tools pages describe these responses.
