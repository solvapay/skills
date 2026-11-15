# Go (`net/http`)

SolvaPay in a Go web app or API on `net/http` (or a router that takes an `http.Handler`): a paywall on a handler, webhooks, hosted checkout, and the backend routes the `@solvapay/react` components call. Docs pages (through the Docs MCP chain in SKILL.md): `/sdks/go/setup/quick-start`, `/sdks/go/guides/webhooks`, `/sdks/go/guides/react-web-checkout`.

## Contents

- Install and env
- Paywall a handler
- Hosted checkout and the React routes
- Webhooks
- Gotchas
- Verification

## Install and env

Go 1.26 or later, in a module (`go mod init <module>` first if there is no `go.mod`).

```bash
npx -y solvapay@latest init --language go
```

`init` signs in through the browser, writes `SOLVAPAY_SECRET_KEY` and `SOLVAPAY_PRODUCT_REF` to `.env`, and runs `go get github.com/solvapay/solvapay-sdk/go@<version> && go mod tidy`.

```go
import solvapay "github.com/solvapay/solvapay-sdk/go"
```

| Variable | Notes |
| --- | --- |
| `SOLVAPAY_SECRET_KEY` | Server only. `NewClient` fails with `missing_secret` without it |
| `SOLVAPAY_PRODUCT_REF` | Read by `NewPaywall` when `ProductRef` is empty; `Payable` fails with `missing_product` without one |
| `SOLVAPAY_WEBHOOK_SECRET` | `whsec_…`, when webhooks are on |
| `SOLVAPAY_API_BASE_URL` | Optional, defaults to `https://api.solvapay.com` |

Go does not read `.env` by itself. Load it in `main` (a small loader, or your process manager's env file) before `NewClient`.

## Paywall a handler

`solvapay.Payable` wraps a function so each call goes through the paywall first. An allowed call runs and is recorded as usage when it returns; a gated one returns a `*solvapay.PaywallError` whose `Gate` says what to do and where to pay.

```go
client, err := solvapay.NewClient(solvapay.Config{}) // SOLVAPAY_SECRET_KEY
if err != nil {
	log.Fatal(err)
}
paywall, err := solvapay.NewPaywall(client, solvapay.PaywallOptions{}) // SOLVAPAY_PRODUCT_REF
if err != nil {
	log.Fatal(err)
}
writeReport, err := solvapay.Payable(paywall, solvapay.PayableOptions{ToolName: "write_report"},
	func(ctx context.Context, call solvapay.PaidCall[reportArgs]) (report, error) {
		return report{Topic: call.Args.Topic, Summary: "..."}, nil
	})
if err != nil {
	log.Fatal(err) // a bad product or free limit fails at startup
}

http.HandleFunc("POST /reports", func(w http.ResponseWriter, r *http.Request) {
	user, err := currentUser(r) // your app's verified session or token
	if err != nil || user == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	var args reportArgs
	if err := json.NewDecoder(r.Body).Decode(&args); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	result, err := writeReport(r.Context(), solvapay.PaidCall[reportArgs]{CustomerRef: user.ID, Args: args})
	var gated *solvapay.PaywallError
	switch {
	case errors.As(err, &gated):
		writeJSON(w, http.StatusPaymentRequired, map[string]any{
			"message": gated.Gate["message"], "checkoutUrl": gated.Gate["checkoutUrl"],
		})
	case err != nil:
		http.Error(w, err.Error(), http.StatusInternalServerError)
	default:
		writeJSON(w, http.StatusOK, result)
	}
})
```

- `PaidCall.CustomerRef` is your own user id (or a SolvaPay `cus_…`). The paywall finds the customer with that `externalRef` or creates it. Empty fails with `identity_required`.
- `PayableOptions`: `Product`, `Meter` (default `requests`), `FreeLimit` (`Cap`, `Scope` `"rolling_window"` with `WindowDays` or `"lifetime"`), `ToolName`.
- The gate's `message` mentions the `account` MCP tool; on a plain HTTP API show your own copy and link to `checkoutUrl`.
- SDK errors are `*solvapay.Error`: branch on `Code` or `Status`, never on `Message`.

## Hosted checkout and the React routes

`solvapay.NewWebHandler` returns an `http.Handler` with every route `@solvapay/react` calls, including the hosted-checkout pair: `POST create-checkout-session` (body `productRef`, optional `planRef`, `returnUrl`) answers `{ sessionId, checkoutUrl }`, and `POST create-customer-session` answers the customer-portal session. Mount it even for hosted checkout without React: your frontend POSTs, then redirects to `checkoutUrl`.

```go
routes, err := solvapay.NewWebHandler(solvapay.WebOptions{
	Client: client,
	GetUser: func(r *http.Request) (*solvapay.WebUser, error) {
		user, err := sessionUser(r) // your app's own session or token check
		if err != nil || user == nil {
			return nil, err // nil, nil → 401; an error → 500
		}
		return &solvapay.WebUser{ID: user.ID, Email: user.Email, Name: user.Name}, nil
	},
	ReturnURL:   "https://app.example.com/billing/return", // where hosted checkout sends the buyer back
	CORSOrigins: []string{"https://app.example.com"},       // browser origins allowed to call the routes
})
if err != nil {
	log.Fatal(err)
}
mux := http.NewServeMux()
mux.Handle("/api/", routes) // BasePath defaults to /api, React's default
```

| Option | Default | What it does |
| --- | --- | --- |
| `GetUser` | required | Verifies the request with your auth. `WebUser.ID` becomes the customer's `externalRef` |
| `BasePath` | `/api` | Where the routes live |
| `ReturnURL` | the request's origin | Where hosted checkout returns. Set it behind a proxy that changes scheme or host |
| `CORSOrigins` | any origin (`*`) | Which browser origins may call the routes. Set it in production |

`NewWebHandler` errors when `Client` or `GetUser` is nil. An `x-user-id` header is ignored; nothing the browser sends is identity. After the return URL, refresh access from server truth (`GET /api/check-purchase`). Frontend wiring: [react.md](react.md) and [hosted-checkout-react.md](hosted-checkout-react.md).

## Webhooks

```go
secret := os.Getenv("SOLVAPAY_WEBHOOK_SECRET") // whsec_...
if secret == "" {
	log.Fatal("SOLVAPAY_WEBHOOK_SECRET is not set")
}

http.HandleFunc("POST /webhooks/solvapay", func(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body) // the raw bytes, before any JSON decoding
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	event, err := solvapay.VerifyWebhook(body, r.Header.Get("SV-Signature"), secret, time.Time{})
	if err != nil {
		log.Printf("rejected webhook: %s", solvapay.ErrorCode(err))
		http.Error(w, "invalid signature", http.StatusUnauthorized)
		return
	}
	fields, _ := event.(map[string]any)
	switch fields["type"] {
	case "purchase.created":
		// grant access
	case "purchase.cancelled":
		// revoke access
	}
	w.WriteHeader(http.StatusOK)
})
```

- `VerifyWebhook(body, signature, secret, now)`: the zero `time.Time` means now. The event is decoded JSON (`map[string]any`, numbers as `json.Number`).
- **Check the secret at startup.** `VerifyWebhook` does not: with an empty secret anyone can sign an event that verifies.
- Error codes (also constants such as `solvapay.WebhookSignatureInvalid`): `webhook_secret_missing`, `webhook_signature_missing`, `webhook_signature_malformed`, `webhook_timestamp_out_of_tolerance` (more than 300 seconds off), `webhook_signature_invalid`, `webhook_payload_invalid`.
- `NewWebHandler` does not include a webhook route; mount this one yourself. Event catalogue: [WEBHOOKS.md](WEBHOOKS.md).

## Gotchas

- `Payable` wraps a function; it does not read the request. Resolve the user with your own auth first and answer 401 before calling it.
- Never set `CustomerRef` from the request body, a query string or an `X-User-ID` header (the docs' quick start uses one only to stay short).
- `CORSOrigins` defaults to any origin. Set your frontend origin(s) in production.
- Go is stricter than TypeScript in a few web-route edge cases (a failed customer or balance read fails the request; a non-object JSON body or an invalid required field gets 400).

## Verification

```bash
npx -y solvapay@latest doctor     # github.com/solvapay/solvapay-sdk/go in go.mod is the newest release
go vet ./... && go test ./...
# Unauthenticated → 401
curl -i -X POST localhost:8080/reports -d '{"topic":"chips"}'
# Signed in, no plan → 402 with checkoutUrl; after a sandbox purchase → 200
curl -i -X POST localhost:8080/reports -H "Authorization: Bearer $TOKEN" -d '{"topic":"chips"}'
```
