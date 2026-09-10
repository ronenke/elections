# Deploying version 2.1 (multi-election, close, new columns, diagnostics)

Three steps, in this order. Nothing on the live site changes until step 3, and step 1 does not affect the running version 1.

## 1. Database migration (Supabase, 2 min)

Supabase dashboard → project `elections` → **SQL Editor** → *New query* → open the file `supabase/migration-002.sql` from the code, paste all of it, **Run**.
Expected: "Success. No rows returned" (a few "already exists, skipping" notices are fine if you run it twice).

✅ Check: *Table Editor* now shows `elections` (1 row — your current election, renamed id `e-migrated-v1`), `app_settings` (1 row, `active_election`), and `snapshots` has a filled `election_id` column. The old `election_state` table stays as a backup; you can drop it later.

## 2. Replace the code in your folder (2 min)

Unzip `elections.zip` and copy its contents **over** the existing files in

```
/Users/ronenke/Library/CloudStorage/GoogleDrive-ronenke@gmail.com/My Drive/Stuff/Sharon/Elections/Elections 2026/System
```

(replace when asked). No files need deleting — this version only adds and updates files.

## 3. Push → Vercel deploys automatically (2 min)

```bash
cd "/Users/ronenke/Library/CloudStorage/GoogleDrive-ronenke@gmail.com/My Drive/Stuff/Sharon/Elections/Elections 2026/System"
git add -A
git commit -m "v2: multiple elections, close/reopen, agreement effect + mandate danger columns"
git push
```

Vercel builds for ~1–2 minutes (Deployments tab shows progress).

✅ Check: open https://elections.keinan.us/admin/elections — you should see your election marked **פעילה · פתוחה**. Open **הזנת קולות**: the line "מנדט = … קולות" appears above the table with the two new columns.

## If something looks wrong after deploying

Open **https://elections.keinan.us/admin/status** (menu: **מצב**). It shows which storage the server is using, whether it can read and write the database, which tables exist, and which election is active — with a green "הכול תקין" or a red list of problems. Send a screenshot of it if anything is red.

Two quick checks that pinpoint the cause of "changes don't stick":
- Supabase → *Table Editor* → `elections`: is the election you created there? If **yes**, the site was reading stale data (v2.1 disables every cache on the database path). If **no**, the site isn't talking to Supabase — check Vercel → Settings → Environment Variables (both `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, enabled for *Production*), then Deployments → ⋯ → **Redeploy** (env-var changes only apply to new deployments).
- Vercel → Deployments: the latest one must be *Ready* and built from your last push (its commit message is shown). If it failed, open it and send the error.

## What changed for the user

- **מערכות בחירות** (new menu item): create an election (name, date, CEC URL; start blank, from the 2026 lists, from the 2022 results for rehearsal, or copy another election's lists/blocs/agreements), choose which one is **active** (the one all screens edit and the board shows), **close** it when results are final (locks votes, lists, agreements, imports and restores — everything shows a 🔒 banner and the board says "תוצאות סופיות"), reopen, or delete (never the active one).
- **הזנת קולות**: "מנדט = N קולות" at the top (the current measure — qualifying votes ÷ 120 — recomputed as you type), and two columns:
  - **הסכם עודפים**: `+1` / `−1` = seats the list has *because of* its surplus agreement, i.e. seats with the agreement minus seats if that agreement did not exist (other agreements unchanged). `0` = has an agreement but no effect right now (including when the partner failed the threshold). Blank = no agreement. Both partners are shown, so a pair that gained a seat shows +1 on the partner who got it.
  - **סכנת מנדט**: five-level colour (green → red) of how safe the list's *last* seat is, relative to the other lists with seats. Ranked by "votes it could lose before losing a seat"; the lists are split into five equal groups by rank (10 lists → 2 per colour). Hover for the exact number.
- **לוח שידור** shows the same two indicators on each list card and "מנדט = N קולות" in the header.

## Rollback (if ever needed)

Vercel → Deployments → previous deployment → ⋯ → *Promote to Production*. The v1 code reads `election_state`, which the migration leaves untouched.
