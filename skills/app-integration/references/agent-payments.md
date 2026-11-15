# Selling API calls to agents (preview)

Agent payments let an AI agent pay for each call to your API from a budget its owner set up with SolvaPay. This is a different buyer from your signed-in users: the agent sends a SolvaPay agent token (a JWT from SolvaPay's agent issuer) or an agent key (`agk_…`) as its bearer token, and SolvaPay decides each call against the owner's spend policy, budget and balance, asking the owner to approve when the policy says so. Your users keep using your own auth and the paywall from the stack guide.

> **Preview.** SolvaPay has to turn agent payments on for the merchant account. Until then every paid call is refused (`unavailable`). The API may change between minor releases. Tell the user this before building, and do not label the result as live.

Selling **MCP tools** to agents is `solvapay/create-mcp-app`, not this skill.

Docs pages (through the Docs MCP chain in SKILL.md): `/sdks/typescript/guides/agents`, `/sdks/python/guides/agents`, `/sdks/go/guides/agents`. Read the one for the backend's language before writing code; the install line and verifier set-up are there.

## The flow for one HTTP call

1. **Identify.** Is the bearer token an agent credential? If not, your own auth decides as usual. If it is and does not verify → 401 (403 when it is from the other environment: sandbox agents pay only sandbox merchants).
2. **Authorize** with an `item` (your label: tool name, model id), an `estimate` (`Money` with a decimal-string amount) and a `requestId` (a retry with the same id continues the same call). SolvaPay holds the estimate, refuses, or waits for the owner.
3. **Run** the upstream.
4. **Finish** with the upstream's status and reported cost, or **release** when the upstream was never reached. A status of 400 or above charges nothing.

Refusal reasons and their HTTP status: `topup_required`, `customer_not_linked`, `ask`, `approval_declined`, `approval_expired`, `approval_timed_out`, `approval_client_closed` → 402; `deny` → 422; `agent_not_accepted` → 401; `unavailable` → 502. Answer with the reason and SolvaPay's message so the agent can act without parsing text.

Environment: `SOLVAPAY_SECRET_KEY`, `SOLVAPAY_PROVIDER_REF` (`prov_…`, tokens for other merchants are refused), issuer `https://api.solvapay.com/v1/agent`.

## TypeScript

`@solvapay/agents/http` has `createAgentHttpGate`, which returns `not_agent`, `rejected`, `refused` or `allowed`; `refusalResponse` writes a refusal:

```ts
const gate = createAgentHttpGate({ agentLayer, calls, log })

const gated = await gate({
  presentedKey,
  requestId: crypto.randomUUID(),
  item: 'quote',
  estimate: { amount: '0.01', currency: 'USD' },
  prompt: promptFacts(symbol),
  signal: request.signal,
})
switch (gated.kind) {
  case 'not_agent':
    return ownAuth(request)
  case 'rejected':
    return Response.json({ error: { type: gated.reason, message: gated.detail } }, { status: gated.status })
  case 'refused':
    return refusalResponse(gated.refused, gated.challenge)
  case 'allowed': {
    const upstream = await fetchQuote(symbol) // on a throw: await gated.allowed.release('upstream_unreachable')
    await gated.allowed.finish({ status: upstream.status, cost: upstream.ok ? { amount: 0.005, currency: 'USD' } : null })
    return new Response(await upstream.text(), { status: upstream.status })
  }
}
```

`agentLayer` and `calls` are built as on the docs page (`createAgentLayer`, `createAgentCalls`).

## Python

`uv add 'solvapay[agents]'`. There is no HTTP gate helper; the building blocks in `solvapay.agents` do the same four steps:

```python
import os
import uuid

from solvapay import AsyncApiClient
from solvapay.agents import (
    AgentCall, AgentCalls, AgentKeyVerifier, AgentLayer, AgentRejected, AgentTokenVerifier,
    CallResult, Money, NotAgent, Refused, prompt_facts, refusal_status,
)
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

ISSUER = "https://api.solvapay.com/v1/agent"
api = AsyncApiClient(api_key=os.environ["SOLVAPAY_SECRET_KEY"], timeout=70)  # authorize can wait 55 s
layer = AgentLayer(
    verify_token=AgentTokenVerifier(issuer=ISSUER, provider_ref=os.environ["SOLVAPAY_PROVIDER_REF"]).verify,
    verify_key=AgentKeyVerifier(api).verify,
)
calls = AgentCalls(api, max_wait_seconds=50)


async def quote(request: Request) -> Response:
    presented = request.headers.get("authorization", "").removeprefix("Bearer ").strip()
    symbol = request.query_params.get("symbol", "")
    identity = await layer.identify(presented)
    if isinstance(identity, NotAgent):
        return await own_auth_quote(request)  # your users: your auth and paywall
    if isinstance(identity, AgentRejected):
        status = 403 if identity.reason == "environment_mismatch" else 401
        return JSONResponse({"error": {"type": identity.reason, "message": identity.detail}}, status_code=status)

    begun = await calls.begin(
        AgentCall(
            request_id=str(uuid.uuid4()),
            agent_token=presented,
            agent=identity,
            item="quote",
            estimate=Money("0.01", "USD"),
            prompt=prompt_facts(symbol),
        )
    )
    if isinstance(begun, Refused):
        return JSONResponse(
            {"error": {"type": begun.reason, "message": begun.message}},
            status_code=refusal_status(begun.reason),
        )
    try:
        upstream = await fetch_quote(symbol)  # your upstream, e.g. an httpx response
    except Exception:
        await begun.release("upstream_unreachable")
        raise
    ok = upstream.status_code < 400
    await begun.finish(CallResult(status=upstream.status_code, cost=("0.005", "USD") if ok else None))
    return Response(upstream.content, status_code=upstream.status_code)
```

The Python docs page shows only the MCP route; this HTTP flow uses the same classes (`AgentLayer.identify`, `AgentCalls.begin`, `Allowed.finish` / `release`, `refusal_status`). Say so in the handoff.

## Go

`github.com/solvapay/solvapay-sdk/go/agents` has `Gate`, whose `Check` returns one of `GateNotAgent`, `GateRejected`, `GateRefused`, `GateAllowed`; `WriteRefusal` writes a refusal as `{"error": {"type", "message"}}`:

```go
gate := &agents.Gate{Layer: &agents.AgentLayer{Tokens: tokens, Keys: keys}, Calls: calls}

http.HandleFunc("GET /quote", func(w http.ResponseWriter, r *http.Request) {
	presented := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
	symbol := r.URL.Query().Get("symbol")
	result, err := gate.Check(r.Context(), agents.GateCall{
		PresentedKey: presented,
		RequestID:    newRequestID(),
		Item:         "quote",
		Estimate:     agents.Money{Amount: "0.01", Currency: "USD"},
	})
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	switch result.Kind {
	case agents.GateNotAgent:
		ownAuthQuote(w, r) // your users: your auth and paywall
	case agents.GateRejected:
		http.Error(w, "agent credential not accepted", result.Status)
	case agents.GateRefused:
		_ = agents.WriteRefusal(w, *result.Refused, result.Challenge)
	case agents.GateAllowed:
		upstream, err := fetchQuote(r.Context(), symbol)
		if err != nil {
			_ = result.Allowed.Release(r.Context(), "upstream_unreachable")
			http.Error(w, "upstream unreachable", http.StatusBadGateway)
			return
		}
		var cost *agents.Cost
		if upstream.StatusCode < 400 {
			cost = &agents.Cost{Amount: 0.005, Currency: "USD"}
		}
		_, _ = result.Allowed.Finish(r.Context(), agents.CallResult{Status: upstream.StatusCode, Cost: cost})
		w.WriteHeader(upstream.StatusCode)
		_, _ = io.Copy(w, upstream.Body)
	}
})
```

`tokens`, `keys` and `calls` are built with `agents.NewTokenVerifier`, `agents.NewKeyVerifier` and `agents.NewCalls` as on the docs page. `Gate.ProtectedResource` turns on the OAuth challenge for hosts that sign in.

## Checklist

- [ ] The user knows agent payments are preview and need enabling on their account
- [ ] Agent credentials and your own users' auth are told apart first; your users' paywall is unchanged
- [ ] Each paid endpoint has an honest `estimate`; the API docs say the maximum cost per call
- [ ] Every allowed call is finished (status + cost) or released, exactly once
- [ ] Refusals answer with the reason and message, at the status above
- [ ] Handoff says what was tested (sandbox agent, approvals) and what was not
