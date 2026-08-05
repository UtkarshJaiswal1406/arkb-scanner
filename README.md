# ARKB Scanner

A mobile-first discount scanner for ARKB. Scan a QR coupon code, see the
coupon's discount, enter the order amount, and apply the discount. Scanned
coupons are recorded and shown in the history panel, filterable by discount
(All / 7% / 10%).

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- Supabase (Postgres) for coupon storage
- Camera QR scanning via the browser Barcode Detection API

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

Copy `.env.example` to `.env.local` and set:

- `SUPABASE_URL` — your Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY` — server-only service-role key (never exposed to
  the client; used by the redeem/apply API routes).

The `coupons` table needs at least: `coupon_code`, `discount`, `status`
(`unscanned` | `scanned`), `scanned_at`, `user_registration_number`.

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run lint` — ESLint