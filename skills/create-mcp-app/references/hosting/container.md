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
2. **`PUBLIC_BASE_URL` must equal the public URL MCP clients use** — the service URL or your custom domain, `https://`, no `/mcp`, no trailing path. It is the OAuth issuer clients see and, in Python, the only public host the server accepts (any other host gets `421`). A wrong value means sign-in fails. **Set it on the first deploy:** the server exits at startup without it, so a deploy that adds it afterwards never becomes healthy.
3. **Secrets go in the host's secret store**, never in the image, the repo or a plain env var in a deploy script. `SOLVAPAY_SECRET_KEY` (and `SOLVAPAY_WEBHOOK_SECRET` if any) are secrets; `SOLVAPAY_PRODUCT_REF`, `PUBLIC_BASE_URL` and `PORT` are plain config. **Keep `.env` out of the image:** both Dockerfiles run `COPY . .`, and the scaffold's `.dockerignore` lists `.env`. A server that was not scaffolded needs a `.dockerignore` with `.env` in it before the first build (and a `.gcloudignore` with the same line for `gcloud run deploy --source`, which uploads the folder).
4. **The endpoint is public.** MCP clients call it without cloud credentials; SolvaPay's OAuth protects `/mcp`. Allow unauthenticated invocations at the host level.
5. **The endpoint is stateless by default** (Python `solvapay` 0.1.1 and Go `v0.1.1` onwards), so any instance can answer any request and the host may run several. Older SDKs keep a session per client in process memory: upgrade (rule 6) rather than pinning to one instance. If you opt back into sessions (`mcp.http_app(stateless_http=False)` in Python, `Stateful: true` in Go's `MCPServerOptions`), run one instance or turn on session affinity.
6. **Run `npx -y solvapay@latest doctor` before every deploy**, and upgrade when its SDK check fails.
7. **Sandbox first.** Deploy with `sk_sandbox_…`; swap to `sk_live_…` in the secret store only at go-live.

## Google Cloud Run

Prerequisites: the `gcloud` CLI, signed in (`gcloud auth login`), a project with billing, and the Cloud Run, Cloud Build, Artifact Registry and Secret Manager APIs enabled. Cloud Run sets `PORT` (8080) itself.

```bash
gcloud config set project <project-id>
gcloud config set run/region <region>           # e.g. europe-west1

# The secret key, from .env, into Secret Manager
printf '%s' "$SOLVAPAY_SECRET_KEY" | gcloud secrets create solvapay-secret-key --data-file=-

# The service URL is known before the first deploy:
# https://<service>-<project number>.<region>.run.app
PROJECT_NUMBER=$(gcloud projects describe <project-id> --format 'value(projectNumber)')
URL="https://my-mcp-${PROJECT_NUMBER}.<region>.run.app"

# First deploy: builds the Dockerfile in the current folder
gcloud run deploy my-mcp --source . \
  --allow-unauthenticated \
  --set-secrets SOLVAPAY_SECRET_KEY=solvapay-secret-key:latest \
  --set-env-vars SOLVAPAY_PRODUCT_REF=prd_...,PUBLIC_BASE_URL="$URL"
```

The runtime service account needs `roles/secretmanager.secretAccessor` on the secret; grant it if the deploy says it cannot read the secret.

`PUBLIC_BASE_URL` goes in on that first deploy because the server exits at startup without it. Cloud Run also gives the service a second `run.app` URL with a generated name. Give clients only the URL you set: through the other one sign-in fails, and Python answers `421`.

With a custom domain, set `PUBLIC_BASE_URL` to that domain instead. Later deploys rerun `gcloud run deploy my-mcp --source .`; env vars and secrets are kept.

Go-live: add a new secret version with the live key (`printf '%s' "$KEY" | gcloud secrets versions add solvapay-secret-key --data-file=-`), then redeploy.

## Fly.io

Prerequisites: `flyctl`, signed in (`fly auth login`).

```bash
fly launch --no-deploy                     # detects the Dockerfile, writes fly.toml
fly secrets set SOLVAPAY_SECRET_KEY=sk_sandbox_...
# edit fly.toml as below, then:
fly deploy
```

Before `fly deploy`, set the plain config and the port in `fly.toml` (the server exits at startup without `PUBLIC_BASE_URL`):

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
