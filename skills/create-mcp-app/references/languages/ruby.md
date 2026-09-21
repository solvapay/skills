# Ruby paid MCP app

Delta only. Shared paywall contract lives in [../tool-design.md](../tool-design.md). Do not open another `languages/*.md`.

Host: `./scripts/http.sh` on **3030**. `inputModes: scratch` only — OpenAPI codegen is not on this row.

## Imports

The scaffolded `tools.rb` lives inside the generated module (`__RUBY_MODULE__` after substitution). The engine is passed in; you do not import a register helper.

```ruby
# frozen_string_literal: true

module MyMcp
  module Tools
    module_function
```

## Registration

```ruby
def register_engine(engine, product:)
  engine.register_payable(
    "get_item",
    product: product,
    title: "Get item",
    description:
      "Returns the requested item. 1 credit per call; when gated, " \
      "text-only narration names `account`.",
    input_schema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
    handler: ->(args, ctx) {
      item_id = args.is_a?(Hash) ? (args["id"] || args[:id]) : nil
      data = load_item(item_id)
      ctx.respond(data)
    },
  )
end
```

`main.rb` calls `Tools.register_engine(engine, product: product)` after the server is built.

## Respond

Paid handlers return `ctx.respond(data)`. Optional narration: pass a Hash the SDK accepts as the presentation side — keep the payload in `respond`'s first argument. Never build a raw MCP `content` array from a paid handler.

```ruby
ctx.respond({ "id" => item_id, "name" => name })
```

## File layout

```
main.rb              HTTP boot
tools.rb             Tools.register_engine
http.rb
Gemfile
scripts/http.sh
```

Replace the placeholder in `tools.rb`. Register additional paid tools in `register_engine`.

## Install and run

```bash
node scripts/check-toolchain.mjs --language ruby
node scripts/scaffold-app.mjs ./my-mcp --language ruby --tool-name generate_haiku --dev
npx -y solvapay@latest init
bundle install
./scripts/http.sh     # :3030
```

If the gate printed `ok checkout`, pass `--dev` so the Gemfile uses `gem "solvapay", path: "…"`.

## Environment

| Variable | Role |
| --- | --- |
| `SOLVAPAY_SECRET_KEY` | Server secret. `.env` only, never client-side |
| `SOLVAPAY_PRODUCT_REF` | `prd_…` |
| `MCP_PUBLIC_BASE_URL` | Public origin (`http://localhost:3030` locally) |
| `SOLVAPAY_API_BASE_URL` | Optional. Local stack: `http://localhost:3010` |
| `MCP_PORT` / `MCP_HOST` | Optional listen override (default `127.0.0.1:3030`) |

## Troubleshooting

- Missing `bundle`: `gem install bundler`.
- Gate `fail missing-ruby-headers`: the interpreter is present but `RbConfig::CONFIG["rubyhdrdir"]` is missing. Install `ruby-dev` (Debian/Ubuntu) or `ruby-devel` (Fedora/RHEL). On macOS use rbenv/ruby-build or Xcode CLT so `ruby.h` is on disk.
- `mkmf can't find header files for ruby` / `ruby.h`: same as missing headers — the native gems (`json_schemer` → `bigdecimal`, `rb_sys`) compile C. Install the matching `-dev`/`-devel` package for this Ruby, then retry `bundle install`.
- `Bundler::PermissionError` writing to the system gem dir: `bundle config set --local path vendor/bundle`, then `bundle install`.
- RubyGems 404 for `solvapay` / `solvapay-mcp` is the expected steady state. This row installs from a local `solvapay-sdk` checkout (`--dev` + `SOLVAPAY_SDK_ROOT`), not from a package registry.
- After a checkout path-dep, compile the native gem in the SDK Ruby package if `bundle install` fails on the extension.
- Scaffolder `⚠️` means install failed — do not continue.
