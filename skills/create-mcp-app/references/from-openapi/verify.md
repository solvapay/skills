# verify — contract checks

Read-only assertions that a running worker (local `wrangler dev` or deployed) satisfies the SolvaPay MCP contract. Inherits the verification checklist from [../../SKILL.md](../../SKILL.md) and turns it into one command.

## When to read this

- A worker is running (locally or deployed).
- You want to confirm OAuth metadata is correct, the tool catalog is shaped right, and (when paid tools exist) the paywall gate returns text-only narration.

## Run

From inside the **scaffolded project directory** (scaffold copies `scripts/verify.mjs` and `scripts/lib/mcp-client.mjs` into the project — do not run this against the skill checkout):

```bash
node scripts/verify.mjs https://my-worker.<account>.workers.dev
```

Works against any reachable URL. For local dev, pass `http://localhost:8787`. No `npm install` in `scripts/` is required — `verify.mjs` uses only Node stdlib plus the bundled MCP client helper.

Run anonymous first — the `oauthProtectedResource`, `oauthAuthorizationServer`, and `toolsList` checks all pass without credentials (a 401 with a well-formed `WWW-Authenticate` challenge satisfies `toolsList`). The `merchantBootstrap` check is the only one that strictly needs a bearer token and is therefore the one that needs human-in-the-loop OAuth.

Passing `verify.mjs` without `--credentials-file` proves the public MCP/OAuth contract, not the full paid path. In that mode `merchantBootstrap` is skipped, and `paywallGate` may also skip when the worker requires bearer auth and the tool catalog cannot be enumerated. Do not summarize that as "paywall verified"; say which checks passed and which skipped.

> **`merchantBootstrap` requires a human at a browser.** `mcpjam oauth login` defaults to `--auth-mode interactive`, which opens a system browser and blocks until you click "Approve" on the SolvaPay consent screen. SolvaPay workers only advertise the `authorization_code` grant type, so neither `--auth-mode client_credentials` nor the headless flow can complete without that human click. Autonomous agents should run `verify.mjs` anonymous, accept `merchantBootstrap: { status: 'skipped' }`, and rely on `scripts/deploy.mjs`'s pre-deploy `GET /v1/sdk/merchant` preflight (no OAuth) to catch the merchant-not-found failure mode.

To exercise the `merchantBootstrap` check (and `paywallGate` against auth-gated workers), install the [MCPJam CLI](https://www.npmjs.com/package/@mcpjam/cli) (one-time):

```bash
npm i -g @mcpjam/cli
# or prefix the next command with `npx -y @mcpjam/cli@latest` to skip the global install
```

Then mint a token. The worker mounts MCP at `/mcp` by default, so pass `<worker-url>/mcp` to `mcpjam`; `verify.mjs` itself still takes the worker root and appends `/mcp`:

```bash
# Opens a browser; click "Approve" on the SolvaPay consent screen.
mcpjam oauth login \
  --url https://my-worker.<account>.workers.dev/mcp \
  --credentials-out /tmp/creds.json

node scripts/verify.mjs https://my-worker.<account>.workers.dev \
  --credentials-file /tmp/creds.json
```

`merchantBootstrap: { status: 'failed' }` with `401` or `Bearer realm` text in `value.message` means the token has expired — re-run the `mcpjam oauth login` command above to refresh `/tmp/creds.json`. The credentials file stores `accessToken` only; `verify.mjs` does not auto-refresh from `refreshToken`.

## What it checks

| Check | Asserts | Skip behaviour |
| --- | --- | --- |
| `oauthProtectedResource` | `/.well-known/oauth-protected-resource` returns `{ resource, authorization_servers: [...] }`. | Never skipped — a hard requirement. |
| `oauthAuthorizationServer` | `/.well-known/oauth-authorization-server` returns `{ issuer, authorization_endpoint, token_endpoint }`. | Never skipped. |
| `toolsList` | Either: (a) `tools/list` (anonymous, or with `--credentials-file` bearer token) succeeds and includes the four intent tools (`upgrade`, `topup`, `activate_plan`, `manage_account`) with no UI-only tools leaked, OR (b) the worker returns `401` with a well-formed `WWW-Authenticate: Bearer resource_metadata="…"` challenge (the SDK default — `requireAuth: true`). | Never skipped. |
| `paywallGate` | Calling any non-intent tool with empty args returns text-only narration in `content[0].text`, the narration names a recovery intent tool, and `_meta.ui` is absent on the gate. | `skipped` when no candidate tool returns a gate, OR when `toolsList` couldn't enumerate the catalog (worker requires bearer auth and no `--credentials-file` passed). |
| `merchantBootstrap` | Calling `manage_account` (`{ mode: 'text' }`) with a real bearer token returns a non-error envelope that does not narrate a `bootstrap`/`Provider not found` failure — i.e. the deployed worker can reach its SolvaPay merchant. | `skipped` when `--credentials-file` is not supplied. |

`paywallGate` reports `skipped` (not `failed`) when no tool returns a gate. It only fails when a tool **does** return a gate but the shape is wrong (text missing, iframe leaked into the gate, intent tool not named in the narration).

## Output

JSON on stdout. Exit code `0` when every check is `passed` or `skipped`, `1` when any check is `failed`.

```jsonc
{
  "workerUrl": "https://my-worker.example.com",
  "checks": {
    "oauthProtectedResource": { "status": "passed", "value": { "resource": "...", "authServer": "..." } },
    "oauthAuthorizationServer": { "status": "passed", "value": { "issuer": "..." } },
    "toolsList": { "status": "passed", "value": { "toolCount": 6, "names": [...] } },
    "paywallGate": { "status": "passed", "value": { "tool": "getPetById", "narrationLength": 240 } }
  },
  "overall": "passed"
}
```

For agent handoff, translate the JSON into a short verification summary:

```markdown
- **Contract checks:** oauthProtectedResource passed; oauthAuthorizationServer passed; toolsList passed
- **Paid gate status:** paywallGate passed / skipped / failed
- **Merchant bootstrap:** passed / skipped; skipped means no human OAuth credentials file was used
- **Upstream smoke:** test.mjs passed / skipped / failed; include whether intent tools were tested manually
```

## What this script does NOT do

- Authenticate. Calls go out anonymous; OAuth-protected operations either gate (paywall) or 401 (which we treat as "couldn't verify").
- Mutate state. Calls are made with empty args so we look at envelope shape, not upstream behaviour.
- Care which framework hosts the worker. Any URL that speaks the MCP transport with SolvaPay's OAuth metadata passes.

## Distinct from `test`

`verify` asserts the worker looks like an MCP server. `test` asserts the worker's tools actually do something. A worker can pass `verify` (correct shape) and fail `test` (broken upstream URL) — that split is intentional.

## Troubleshooting

### OAuth metadata points at `localhost`

Symptom: a remote MCP host (ChatGPT, MCPJam, Claude Desktop) fails to connect to your worker even though `wrangler dev` is up. `curl <worker>/.well-known/oauth-protected-resource` returns `{"resource":"http://localhost:8787",...}`.

Cause: `MCP_PUBLIC_BASE_URL` in `.env` is `http://localhost:8787` (the default). The worker hands that out as the canonical resource identifier; the remote host follows it back to `localhost`, can't reach it, and gives up before the OAuth handshake.

Fix: set `MCP_PUBLIC_BASE_URL` to the URL the remote host is using (e.g. `https://my-worker.<subdomain>.workers.dev`), then restart `wrangler dev`. The worker module-scopes its handler, so a file save isn't enough — full restart.

### `wrangler dev` quick tunnels (press `[t]`)

Quick tunnels are convenient but fragile for SolvaPay MCP testing:

- **Rotating hostname.** Each `wrangler dev` start picks a new `*.trycloudflare.com` subdomain. `MCP_PUBLIC_BASE_URL` has to match the current hostname, so you end up restarting twice (once to learn the hostname, once with it baked into `.env`).
- **`cloudflared` SHA mismatch.** Wrangler ships a pinned hash for the auto-downloaded `cloudflared` binary; when Cloudflare republishes that release, the check fails. Workaround: `brew install cloudflared` and either rely on `PATH` or set `CLOUDFLARED_PATH=$(which cloudflared)`.
- **Cached handler.** The scaffold's `worker.ts` caches the `createSolvaPayMcpFetch` handler at isolate scope, so env changes only land after a full restart of `wrangler dev`.

For testing against a real MCP host, deploying to a stable `*.workers.dev` URL (`npm run deploy`) is faster and avoids all three pitfalls.

### Running verify against the wrong path

`verify.mjs` accepts the worker root (`http://localhost:8787`) and appends `/mcp` automatically when posting JSON-RPC, while keeping the worker root for `/.well-known/*` GETs. Workers that override `mcpPath` away from the SDK default of `/mcp` need to pass the full MCP URL.

### Upstream returns XML / HTML / non-JSON

A tool call returning `isError: true` with text starting `Upstream <METHOD> <url> returned <status> <contentType>` almost always means the spec's `servers[0].url` doesn't serve the operation's path. Fix: re-run `describe.mjs`, check `serverProbe` / `servers[0].url` in output, correct or confirm the upstream base URL, and inspect path-prefix outliers such as `/apifhir/...` among `/api/fhir/...` siblings. Hand-tuned tools can `catch` typed `UpstreamError` and branch on `err.status` / `err.contentType` / `err.bodySnippet`.

## Hand-off

When all checks pass, move to [test.md](test.md).
