---
name: lovable-checkout
description: >
  Paste-in SolvaPay hosted checkout for Lovable-generated apps (Vite + React + TypeScript +
  shadcn/ui + Supabase). Backend is Supabase Edge Functions — no Node server to add. Use
  when the user says "lovable", "vite checkout", "shadcn checkout", "supabase edge checkout",
  "solvapay in lovable", "paste this into lovable", or "@preview". Pinned to the floating
  `@preview` tag and the SolvaPay dev backend (`https://api-dev.solvapay.com`). Not for
  production. Use `website-checkout` for Next.js / production web apps, or `sdk-integration`
  for general SDK wiring.
---

# Lovable Checkout (preview)

Self-contained guide for wiring SolvaPay hosted checkout into a Lovable app. The whole guide is designed to be pasted into the Lovable chat to bias its agent toward a working integration on turn zero.

## Quick Start

1. Read [guide.md](guide.md) end-to-end before generating code. The guide owns environment setup, Supabase edge function templates, the `@preview` install commands, and the Lovable-specific guardrails.
2. Cross-reference [reference.md](reference.md) for the package + hook map.

## Guardrails

- **Never** put `SOLVAPAY_SECRET_KEY` in `.env`, `VITE_*`, `import.meta.env`, or any file the browser can reach. The secret lives **only** as a Supabase edge function secret.
- **Never** hand-roll `fetch` against `https://api-dev.solvapay.com` from the browser. All SolvaPay backend calls go through Supabase edge functions.
- **Always** install with the `@preview` tag: `@solvapay/react@preview`, `@solvapay/react-supabase@preview`. Never pin an exact preview version.
- **Always** set `SOLVAPAY_API_BASE_URL=https://api-dev.solvapay.com` as a Supabase edge function secret — production keys are rejected by api-dev.
- Not for production. The `@preview` tag is unstable by design.
