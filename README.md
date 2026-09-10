# חישוב מנדטים — הבחירות לכנסת ה-26

Knesset seat allocation (Bader-Ofer, חוק הבחירות לכנסת §81–82) from live vote counts, for on-air use.

- `src/lib/engine/baderOfer.ts` — the allocation engine. Exact integer arithmetic (BigInt cross-multiplication), threshold ≥ 3.25%, surplus agreements, legal tie rules, full audit trace, self-check that seats sum to 120. `seatSensitivity` finds how many votes a list is from gaining/losing a seat.
- `src/lib/engine/baderOfer.test.ts` — reproduces the official 2021 and 2022 results, edge cases (threshold equality, float-rounding trap, ties, partner below threshold), and 3,000 fuzzed elections against an independent oracle.
- `src/lib/cec/parse.ts` — parses the CEC national results table from fetched HTML or pasted text and matches rows to configured lists.
- `src/app/` — Next.js 14 app: `/login`, `/` on-air board, `/admin` vote entry, `/admin/import`, `/admin/setup`, `/admin/audit`, `/admin/history`, plus `/api/*` routes.
- `src/lib/store.ts` — Supabase Postgres in production; a local JSON file when Supabase env vars are absent.
- `src/lib/auth.ts` + `src/middleware.ts` — single fixed admin credential, HMAC-signed session cookie; everything except `/login` requires it.

See **SETUP.md** for deployment (GitHub → Supabase → Vercel → DNS) and the election-night runbook.

```bash
npm install && npm test && npm run dev
```
