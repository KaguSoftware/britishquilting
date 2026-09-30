# British Quilting

The storefront and back office for British Quilting, a family-run London shop (trading name of Intermode Limited, since 1990) selling curtain linings, interlinings and workroom paper, cut to order by the metre or sold by the roll or item. Retail and trade (wholesale) customers, with trade pricing and pay-by-invoice.

Live at [britishquilting.vercel.app](https://britishquilting.vercel.app) (production domain to follow, see `SETUP.md`).

## Stack

- [Next.js](https://nextjs.org) 16 (App Router, Turbopack) + React 19 + TypeScript (strict)
- [Tailwind CSS](https://tailwindcss.com) 4
- [Supabase](https://supabase.com) — Postgres, Auth, Storage, row-level security throughout
- [Stripe](https://stripe.com) (cards, Apple Pay, Google Pay) and [PayPal](https://developer.paypal.com) for payments, plus invoice/pay-by-bank for trade accounts
- [Resend](https://resend.com) for transactional email
- [Vitest](https://vitest.dev) for unit tests

This repo targets a very recent Next.js release with real breaking changes from what most tooling and training data assumes (Middleware was renamed **Proxy**, for one). See `AGENTS.md` before making framework-level changes.

## Getting started

```bash
npm ci
cp .env.example .env.local   # fill in the values, see SETUP.md
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign up, then follow `SETUP.md` section 1 to promote your account to shop owner and open `/admin`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run start` | Serve a production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generates route types (`next typegen`), then `tsc --noEmit` |
| `npm run test` | Runs the Vitest suite |

All four checks (`lint`, `typecheck`, `test`, `build`) run in CI on every push and pull request to `main` — see `.github/workflows/ci.yml`.

## Project layout

- `src/app/(site)` — the public storefront: shop, product pages, checkout, account area
- `src/app/admin` — the back office: orders, products, customers, discounts, the financial tracker
- `src/app/api` — payment webhooks (Stripe, PayPal)
- `src/lib` — data access, server actions, pricing and checkout logic
- `src/components` — `ui/` (hand-built controls: dropdowns, date pickers, checkboxes — no native browser controls), `shop/`, `admin/`, `site/`, plus a bespoke icon set in `icons.tsx`
- `supabase/migrations` — the full database schema, including RLS policies

## Documentation

- **`SETUP.md`** — everything left to launch: accounts, API keys, real product content. Written for the shop owner, not engineers.
- **`HANDOFF.md`** — current engineering status, conventions, and open threads. Read this first when picking the project back up.
- **`CLAUDE.md`** / **`AGENTS.md`** — house rules and framework-version notes for AI-assisted work in this repo.

## Deployment

Deployed on [Vercel](https://vercel.com), connected to this repository's `main` branch. Environment variables are documented in `.env.example`; see `SETUP.md` for how to obtain each one and switch from test/sandbox to live credentials.
