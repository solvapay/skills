# Python (Starlette and FastAPI)

SolvaPay in a Python web app or API: a paywall on a route, webhooks, hosted checkout, and the backend routes the `@solvapay/react` components call. Starlette and FastAPI only. Docs pages (through the Docs MCP chain in SKILL.md): `/sdks/python/setup/quick-start`, `/sdks/python/guides/webhooks`, `/sdks/python/guides/react-web-checkout`.

## Contents

- Install and env
- Paywall a route
- Hosted checkout and the React routes
- Webhooks
- Gotchas
- Verification

## Install and env

Python 3.10 or later.

```bash
npx -y solvapay@latest init --language python --features web
```

`init` signs in through the browser, writes `SOLVAPAY_SECRET_KEY` and `SOLVAPAY_PRODUCT_REF` to `.env`, and pins the SDK exactly with `uv add` or `poetry add`. In a plain-pip project it installs nothing and prints the `python -m pip install 'solvapay[web]==<version>'` line: run it and add the pin to `requirements.txt`.

| Extra | Adds |
| --- | --- |
| `solvapay` | `payable()`, the API client, `verify_webhook` |
| `solvapay[web]` | `solvapay.web.routes()` for `@solvapay/react` |

| Variable | Notes |
| --- | --- |
| `SOLVAPAY_SECRET_KEY` | Server only. `create_solvapay()` raises `missing_secret` without it |
| `SOLVAPAY_PRODUCT_REF` | The product paid calls bill against. Read when `@solvapay.payable()` decorates, so set it before the module is imported |
| `SOLVAPAY_WEBHOOK_SECRET` | `whsec_…`, when webhooks are on |
| `SOLVAPAY_API_BASE_URL` | Optional, defaults to `https://api.solvapay.com` |

Load `.env` before importing the module that decorates paid functions (python-dotenv's `load_dotenv()` at the top of the entry file, or the process manager's env file).

## Paywall a route

`@solvapay.payable()` wraps an **async** function. Each call is checked against the customer's plan first; an allowed call runs and is recorded as usage, a gated one raises `PaywallError`. The customer is your own user id, passed as the `customer_ref` keyword argument (rename it with `customer_ref_arg=`), and must come from your verified auth.

FastAPI:

```python
from fastapi import Depends, FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from solvapay import PaywallError, create_solvapay

solvapay = create_solvapay()  # SOLVAPAY_SECRET_KEY, SOLVAPAY_PRODUCT_REF
app = FastAPI()


class SummariseIn(BaseModel):
    text: str


@solvapay.payable()
async def summarise(text: str, *, customer_ref: str) -> str:
    return text[:100]


@app.post("/summarise")
async def summarise_route(body: SummariseIn, user: User = Depends(current_user)):  # your auth dependency
    try:
        summary = await summarise(body.text, customer_ref=user.id)
    except PaywallError as error:
        return JSONResponse(
            {"message": error.gate["message"], "checkoutUrl": error.gate["checkoutUrl"]},
            status_code=402,
        )
    return {"summary": summary}
```

Starlette is the same with a plain route function: read the body with `await request.json()`, take the user from your session middleware, and return `JSONResponse(..., status_code=402)` on `PaywallError`.

- `PaywallError.gate` keys: `kind` (`payment_required` or `activation_required`), `message`, `checkoutUrl` (can be empty: check before redirecting), `reason` (`upgrade_required`, `topup_required`, `limit_reached`, …), `plans`.
- The gate `message` is written for MCP clients and mentions the `account` tool. In a web app or API, show your own copy and link to `checkoutUrl`.
- `@solvapay.payable(product="prd_...", meter="...", free_limit=FreeLimit(cap=..., scope=..., window_days=...))` sets the product, meter and a free allowance per function.
- A call without `customer_ref` raises `SolvaPayError` with code `identity_required` (status 401). Answer 401 for unauthenticated requests before calling the paid function.
- If the function raises, the call is recorded as failed and the exception reaches you unchanged.

## Hosted checkout and the React routes

`solvapay.web.routes()` serves every route `@solvapay/react` calls, including the hosted-checkout pair: `POST create-checkout-session` (body `productRef`, optional `planRef`, `returnUrl`) answers `{ sessionId, checkoutUrl }`, and `POST create-customer-session` answers the customer-portal session. Mount it even for hosted checkout without React: your frontend POSTs, then redirects to `checkoutUrl`.

```python
from starlette.requests import Request
from solvapay import create_solvapay
from solvapay.web import User, routes


async def get_user(request: Request) -> User | None:
    session = await my_app_session(request)  # your app's own session or token check
    if session is None:
        return None
    return User(id=session.user_id, email=session.email, name=session.name)


solvapay = create_solvapay()
app.mount("/api", routes(solvapay, get_user=get_user, base_path=""))  # FastAPI
# Starlette: Starlette(routes=[Mount("/api", app=routes(solvapay, get_user=get_user, base_path=""))])
```

- `get_user` is required and is the only source of identity. Your user's `id` becomes the SolvaPay customer's `externalRef`; the customer is created on first use with the email and name. `None` answers 401 before SolvaPay is called. An `x-user-id` header is ignored.
- `base_path` is where the routes sit below the mount point: `""` when mounted at `/api`, the default `/api` when served at the root.
- The routes add no CORS headers. Serve `/api` from the page's origin, or add Starlette's `CORSMiddleware` for a cross-origin frontend.
- After the return URL, refresh access from server truth (`GET /api/check-purchase`), not from the redirect.

Frontend wiring: [react.md](react.md) and [hosted-checkout-react.md](hosted-checkout-react.md).

## Webhooks

```python
import os

from solvapay import SolvaPayError, verify_webhook
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

WEBHOOK_SECRET = os.environ["SOLVAPAY_WEBHOOK_SECRET"]  # fail at startup when unset


@app.post("/webhooks/solvapay")
async def solvapay_webhook(request: Request) -> Response:
    try:
        event = verify_webhook(
            body=await request.body(),  # the raw bytes, before any JSON parsing
            signature=request.headers.get("sv-signature"),
            secret=WEBHOOK_SECRET,
        )
    except SolvaPayError as error:
        return JSONResponse({"error": error.code}, status_code=401)

    if event["type"] == "purchase.created":
        ...  # grant access
    elif event["type"] == "purchase.cancelled":
        ...  # revoke access
    return Response(status_code=200)
```

- Pass the body exactly as received. In FastAPI take `request: Request` and `await request.body()`; never declare a pydantic body model on the webhook route, because the re-serialized JSON fails the signature.
- `verify_webhook` raises `SolvaPayError` with a code: `webhook_secret_missing` (empty secret — checked first, so every delivery fails until it is set), `webhook_signature_missing`, `webhook_signature_malformed`, `webhook_timestamp_out_of_tolerance` (more than 300 seconds off), `webhook_signature_invalid`, `webhook_payload_invalid`. Answer a 4xx so the delivery shows as failed in SolvaPay Console.
- The event is a plain dict. Event catalogue: [WEBHOOKS.md](WEBHOOKS.md).

## Gotchas

- **FastAPI dependencies don't run for mounted routes.** `routes()` is a mounted Starlette app, so `get_user` gets the plain Starlette `Request` and no `Depends(...)` runs for it. If your app checks users with a dependency such as `Depends(current_user)`, call the function behind that dependency from `get_user`.
- `payable()` wraps async functions only; a sync function raises `invalid_argument`.
- `SOLVAPAY_PRODUCT_REF` is read when the decorator runs: a missing product fails at import, not on the first call.
- Never take `customer_ref` from the request body, a query string or an `x-user-id` header.
- Python fails where TypeScript carries on in a few web-route edge cases (a failed customer read in `check-purchase`, a failed balance read during a top-up, a non-object JSON body gets 400).

## Verification

```bash
npx -y solvapay@latest doctor     # SDK pin in uv.lock / poetry.lock / requirements.txt is the newest release
# Unauthenticated → 401
curl -i -X POST http://localhost:8000/summarise -H 'content-type: application/json' -d '{"text":"hi"}'
# Signed in, no plan → 402 with checkoutUrl; after a sandbox purchase → 200
curl -i -X POST http://localhost:8000/summarise -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{"text":"hi"}'
```
