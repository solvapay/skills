# Selling MCP tools to agents (preview)

Agent payments let an AI agent pay for each tool call from a budget its owner set up with SolvaPay. This is a different buyer from the signed-in customer the rest of this skill covers: the agent presents a SolvaPay agent token (a JWT from SolvaPay's agent issuer) or an agent key (`agk_…`), and SolvaPay decides each call against the owner's spend policy, budget and balance, asking the owner to approve when the policy says so.

> **Preview.** SolvaPay has to turn agent payments on for the merchant account. Until then every paid call is refused (`unavailable`). The API may change between minor releases. Tell the user this before building, and do not label the result as live.

Docs pages (through the Docs MCP chain in SKILL.md): `/sdks/typescript/guides/agents`, `/sdks/python/guides/agents`, `/sdks/go/guides/agents`. Read the one for the project's language before writing code; the install line and options are there.

## How a paid call works

1. **Identify.** The SDK tells an agent credential from the merchant's own, verifies an agent token against `<issuer>/jwks.json`, and asks SolvaPay about an agent key (cached 30 seconds).
2. **Authorize.** Before the tool runs, the SDK sends the call's `item` and `estimate`. SolvaPay holds the estimate, refuses, or waits up to `max_wait_seconds` for the owner's approval.
3. **Run.** Your `run` calls the upstream and returns its HTTP status, the cost it reported and the result.
4. **Complete.** SolvaPay settles at the reported cost. A status of 400 or above charges nothing; an error from `run` releases the hold.

A refusal is a tool error whose `structuredContent.refusal.reason` is one of `topup_required`, `customer_not_linked`, `ask`, `approval_declined`, `approval_expired`, `approval_timed_out`, `approval_client_closed`, `deny`, `agent_not_accepted`, `unavailable`.

## Environment

| Variable | What it is |
| --- | --- |
| `SOLVAPAY_SECRET_KEY` | Your secret key. Its prefix sets the environment: sandbox agents pay sandbox merchants only. |
| `SOLVAPAY_PROVIDER_REF` | Your merchant (provider) reference, `prov_…`. Tokens issued for another merchant are refused. |
| Agent issuer | `https://api.solvapay.com/v1/agent` |
| `PUBLIC_BASE_URL` | As for the customer server; the protected resource is `<PUBLIC_BASE_URL>/mcp`. |

## Same endpoint as signed-in customers

The agent route sits **in front of** the paid MCP server from this skill: requests on `/mcp` that carry an agent credential go to the agent route, everything else reaches the customer server unchanged. Keep both.

## TypeScript

Package `@solvapay/agents` (MCP route at `@solvapay/agents/mcp`). The route is fetch-style and returns `null` for requests that are not an agent's:

```ts
const agents = createAgentMcpRoute({
  issuer,
  agentLayer: createAgentLayer({ verifyAgentToken, verifyAgentKey }),
  calls: createAgentCalls({ client, maxWaitSeconds: 50, log }),
  log,
  mcpPath: '/mcp',
  serverName: 'quotes',
  tools: (_server, paid) =>
    paid<{ symbol: string }>({
      name: 'get_quote',
      description: 'The latest price for a ticker symbol. Up to 0.01 USD per call.',
      inputSchema: { symbol: z.string().min(1).max(8) },
      item: () => 'get_quote',
      estimate: () => ({ amount: '0.01', currency: 'USD' }),
      run: async ({ symbol }) => ({
        status: 200,
        cost: { amount: 0.005, currency: 'USD' },
        result: { content: [{ type: 'text', text: JSON.stringify({ symbol, price: 182.5 }) }] },
      }),
    }),
})

export default {
  async fetch(request: Request) {
    return (await agents(request)) ?? existingHandler(request)
  },
}
```

The verifier and client set-up (`createSolvaPayAgentClient`, `createAgentTokenVerifier`, `createAgentKeyVerifier`) is on the docs page. On Workers, turn on `nodejs_compat`.

## Python

`uv add 'solvapay[agents,mcp]'`. `route.middleware(app)` answers agents on `/mcp` and passes everything else to `app`, here the customer server's `http_app()`:

```python
import os

from mcp.types import CallToolResult, TextContent
from pydantic import BaseModel, Field
from solvapay import AsyncApiClient
from solvapay.agents import AgentCalls, AgentKeyVerifier, AgentLayer, AgentTokenVerifier, Money
from solvapay.agents.mcp import PaidCall, PaidTool, PaidToolRun, create_agent_mcp_route

ISSUER = "https://api.solvapay.com/v1/agent"
api = AsyncApiClient(api_key=os.environ["SOLVAPAY_SECRET_KEY"], timeout=70)  # authorize can wait 55 s


class Question(BaseModel):
    question: str = Field(description="What to answer.")


async def answer(args: Question, call: PaidCall) -> PaidToolRun:
    return PaidToolRun(
        status=200,
        cost=("0.004", "USD"),
        result=CallToolResult(content=[TextContent(type="text", text=f"You asked: {args.question}")]),
    )


route = create_agent_mcp_route(
    issuer=ISSUER,
    agent_layer=AgentLayer(
        verify_token=AgentTokenVerifier(issuer=ISSUER, provider_ref=os.environ["SOLVAPAY_PROVIDER_REF"]).verify,
        verify_key=AgentKeyVerifier(api).verify,
    ),
    calls=AgentCalls(api, max_wait_seconds=50),
    mcp_path="/mcp",
    server_name="research",
    tools=lambda _server, paid, _call: paid(
        PaidTool(
            name="answer",
            description="Answers a question. Up to 0.01 USD per call.",
            input=Question,
            item=lambda _args: "answer-v1",
            estimate=lambda _args: Money("0.01", "USD"),
            run=answer,
        )
    ),
)

app = route.middleware(mcp.http_app())  # mcp: the create_solvapay_mcp_server from server.py
```

For host sign-in (Claude, ChatGPT), pass `protected_resource=ProtectedResource(resource=f"{PUBLIC_BASE_URL}/mcp")` (from `solvapay.agents.mcp`) to `create_agent_mcp_route` and the same URL as `resource=` to `AgentTokenVerifier`.

## Go

Package `github.com/solvapay/solvapay-sdk/go/agents`. `route.Middleware(handler)` sends agents to the route and everything else to the customer server's `Handler()`:

```go
environment := agents.SecretKeyEnvironment(secretKey)
client, err := agents.NewClient(solvapay.Config{APIKey: secretKey})
tokens, err := agents.NewTokenVerifier(agents.TokenVerifierOptions{
	Issuer: issuer, ProviderRef: os.Getenv("SOLVAPAY_PROVIDER_REF"),
	Resource: publicBaseURL + "/mcp", Environment: environment,
})
keys, err := agents.NewKeyVerifier(agents.KeyVerifierOptions{Client: client, Environment: environment})
calls, err := agents.NewCalls(agents.CallsOptions{Client: client, MaxWaitSeconds: 50})

route, err := agents.NewMCPRoute(agents.MCPRouteOptions{
	Issuer:            issuer, // "https://api.solvapay.com/v1/agent"
	Layer:             &agents.AgentLayer{Tokens: tokens, Keys: keys},
	Calls:             calls,
	MCPPath:           "/mcp",
	ServerName:        "research",
	ProtectedResource: &agents.ProtectedResource{Resource: publicBaseURL + "/mcp"},
	Tools: func(_ *mcp.Server, paid *agents.PaidTools, _ *agents.AgentRequest) {
		agents.AddPaidTool(paid, agents.PaidTool[quoteArgs]{
			Name:        "get_quote",
			Description: "Latest price for a ticker symbol. Up to 0.01 USD per call.",
			Item:        func(quoteArgs) string { return "get_quote" },
			Estimate:    func(quoteArgs) agents.Money { return agents.Money{Amount: "0.01", Currency: "USD"} },
			Run: func(ctx context.Context, args quoteArgs, call agents.PaidCall) (agents.PaidToolRun, error) {
				return agents.PaidToolRun{
					Status: 200,
					Cost:   &agents.Cost{Amount: 0.005, Currency: "USD"},
					Result: &mcp.CallToolResult{Content: []mcp.Content{&mcp.TextContent{Text: "101.5"}}},
				}, nil
			},
		})
	},
})

log.Fatal(http.ListenAndServe(":"+os.Getenv("PORT"), route.Middleware(server.Handler())))
```

Check every `err`. `quoteArgs` is a struct with `json` and `jsonschema` tags; the schema is inferred from it.

## Checklist

- [ ] The user knows agent payments are preview and need enabling on their account
- [ ] `SOLVAPAY_PROVIDER_REF` set; secret key in the host's secret store
- [ ] Each paid tool has an honest `estimate` and says the maximum cost in its description
- [ ] `run` returns the upstream's real status and cost; a failed upstream returns its error status
- [ ] The agent route wraps the customer server, so signed-in customers still work
- [ ] Handoff says what was tested (sandbox agent, approvals) and what was not
