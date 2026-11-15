# Container hosting (Python and Go)

Deploy a Python or Go paid MCP server as a container. TypeScript servers deploy to Cloudflare Workers instead: [cloudflare/README.md](cloudflare/README.md).

The documented host is **Google Cloud Run**. **Fly.io** is the alternative. Any host that runs a container behind HTTPS works the same way; the rules below are what matter.

## Contents

- Rules for every host
- Google Cloud Run
- Fly.io
- After deploy

## Rules for every host

1. **Use the scaffold's `Dockerfile`.** Python: a uv image that runs `server.py`. Go: a multi-stage build that ships one static binary. Both listen on `PORT`.
2. **`PUBLIC_BASE_URL` must equal the public URL MCP clients use** — the service URL or your custom domain, `https://`, no `/mcp`, no trailing path. It is the OAuth issuer clients see and, in Python, the only public host the server accepts (any other host gets `421`). A wrong value means sign-in fails.
3. **Secrets go in the host's secret store**, never in the image, the repo or a plain env var in a deploy script. `SOLVAPAY_SECRET_KEY` (and `SOLVAPAY_WEBHOOK_SECRET` if any) are secrets; `SOLVAPAY_PRODUCT_REF`, `PUBLIC_BASE_URL` and `PORT` are plain config.
4. **The endpoint is public.** MCP clients call it without cloud credentials; SolvaPay's OAuth protects `/mcp`. Allow unauthenticated invocations at the host level.
5. **Sessions live in process memory.** The MCP endpoint is stateful in both SDKs, so a follow-up request must reach the instance that holds its session. Start with one instance; scale out only with session affinity.
6. **Run `npx -y solvapay@latest doctor` before every deploy**, and upgrade when its SDK check fails.
7. **Sandbox first.** Deploy with `sk_sandbox_…`; swap to `sk_live_…` in the secret store only at go-live.

## Google Cloud Run

Prerequisites: the `gcloud` CLI, signed in (`gcloud auth login`), a project with billing, and the Cloud Run, Cloud Build, Artifact Registry and Secret Manager APIs enabled. Cloud Run sets `PORT` (8080) itself.

```bash
gcloud config set project <project-id>
gcloud config set run/region <region>           # e.g. europe-west1

# The secret key, from .env, into Secret Manager
printf '%s' "$SOLVAPAY_SECRET_KEY" | gcloud secrets create solvapay-secret-key --data-file=-

# First deploy: builds the Dockerfile in the current folder
gcloud run deploy my-mcp --source . \
  --allow-unauthenticated \
  --max-instances 1 \
  --set-secrets SOLVAPAY_SECRET_KEY=solvapay-secret-key:latest \
  --set-env-vars SOLVAPAY_PRODUCT_REF=prd_...
```

The runtime service account needs `roles/secretmanager.secretAccessor` on the secret; grant it if the deploy says it cannot read the secret.

Then set `PUBLIC_BASE_URL` to the URL Cloud Run assigned:

```bash
URL=$(gcloud run services describe my-mcp --format 'value(status.url)')
gcloud run services update my-mcp --update-env-vars PUBLIC_BASE_URL="$URL"
```

With a custom domain, set `PUBLIC_BASE_URL` to that domain instead. Later deploys rerun `gcloud run deploy my-mcp --source .`; env vars and secrets are kept. To scale beyond one instance, add `--session-affinity` and raise `--max-instances`.

Go-live: add a new secret version with the live key (`printf '%s' "$KEY" | gcloud secrets versions add solvapay-secret-key --data-file=-`), then redeploy.

## Fly.io

Prerequisites: `flyctl`, signed in (`fly auth login`).

```bash
fly launch --no-deploy                     # detects the Dockerfile, writes fly.toml
fly secrets set SOLVAPAY_SECRET_KEY=sk_sandbox_...
fly deploy
fly scale count 1
```

In `fly.toml`, set the plain config and the port:

```toml
[env]
  PORT = "8080"
  SOLVAPAY_PRODUCT_REF = "prd_..."
  PUBLIC_BASE_URL = "https://<app>.fly.dev"

[http_service]
  internal_port = 8080
```

`PUBLIC_BASE_URL` is `https://<app>.fly.dev` or your custom domain.

## After deploy

```bash
npx -y solvapay@latest verify https://<public-url>
```

It checks the OAuth discovery documents, that `tools/list` has `account` and `activate_plan` with the widget tools hidden (or a well-formed 401 challenge), the paywall gate narration and the `account` default view, and exits 1 on failure. Then add `https://<public-url>/mcp` to an MCP client, sign in, call a paid tool once with a customer that has a plan (success path) and once without (gate path).

Report the host, the public URL and the verify result in the SKILL.md handoff.
