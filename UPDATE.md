# Updating the site

## Routine update (every new version): copy, commit, push — 3 minutes

1. Unzip `elections.zip` and copy its contents **over** the existing files in
   ```
   /Users/ronenke/Library/CloudStorage/GoogleDrive-ronenke@gmail.com/My Drive/Stuff/Sharon/Elections/Elections 2026/System
   ```
   (replace when asked; nothing needs deleting).
2. In Terminal:
   ```bash
   cd "/Users/ronenke/Library/CloudStorage/GoogleDrive-ronenke@gmail.com/My Drive/Stuff/Sharon/Elections/Elections 2026/System"
   git add -A
   git commit -m "update"
   git push
   ```
3. Vercel builds for ~1–2 minutes (Deployments tab). Then open https://elections.keinan.us/admin/status — it should be green.

That is all a normal version needs. **Database changes are the exception**, and when a version needs one this file will say so at the top of its entry, with a new numbered file under `supabase/` (`migration-003.sql`, …) to run once in the Supabase SQL editor *before* pushing.

## One-time migration (already done — do not repeat)

`supabase/migration-002.sql` converted the v1 database (single election) to the v2 layout. You ran it when moving to v2. It is safe to run again (it skips what exists and never deletes your data), but there is no reason to. Versions 2.1, 2.2, 2.3, 2.4 and 2.5 need no database change.

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
- **v2.2**: parliament diagram (120 seats on arcs, blocs fill from the right, the 61 line marks a majority; hover a seat for its list), bloc cards beside it, redesigned list cards with a two-cell footer ("למנדט נוסף: עוד N" / "מרווח עד איבוד מנדט: N"), and **עריכת פרטים** on the elections screen to change an election's name, date or CEC URL (also when closed). Default bloc colours changed to a colour-blind-safe trio; existing elections keep whatever colours they have.

- **v2.3 — CEC import fix**: the parser previously took the *first* number in a row as the vote count; on the CEC's final-results page the column order is name, letters, **mandates**, percent, votes, so mandates would have been read as votes. Now columns are identified by their header text ("מספר הקולות", "מנדטים", "אחוז"…), never by position. Every import is cross-checked — each list's percent must equal votes ÷ total, the sum may not exceed the published total, and tiny "votes" next to a real percentage are rejected — and any inconsistency **blocks** the apply button with a red explanation. When the CEC publishes mandates (final results), they are compared list by list with our own calculation and any difference is shown in red. Tip: paste the whole page (Ctrl+A, Ctrl+C), so the header row and the total valid votes are included.

- **v2.4**:
  - **Second user for viewing only.** Log in as `user` to get the on-air board and nothing else (no ניהול link, all admin pages and write APIs refused). By default `user`'s password is the same as the admin password. To give the viewer a different password, or a different name, add in Vercel → Settings → Environment Variables: `VIEWER_USERNAME` and/or `VIEWER_PASSWORD`, then *Redeploy*. The board now has a **יציאה** button (top-right, next to the live indicator); the ניהול link shows only for the admin.
  - **ניהול / לוח שידור** links open in the same tab.
  - **רשימות והסכמים**: the "חזרה גנרלית 2022" and "איפוס 2026" buttons are gone (a 2022 rehearsal is still available as a template when creating an election on the מערכות בחירות screen). Instead, **טעינת רשימות מהדבקה**: paste one line per list — `שם המפלגה | אות | גוש | מפלגה שותפה להסכם עודפים` (separator `|` or tab; bloc and partner optional; an optional header line). *עדכון הרשימה הקיימת* matches existing lists by letters, then by name, updates them, adds new ones, keeps the others and keeps all votes; *החלפה מלאה* rebuilds lists, blocs and agreements from the paste and resets votes. Blocs that don't exist are created. The partner can be given by name or letters and on either line; contradictions, unknown partners, duplicates and a list in two agreements are reported and block the apply. Nothing is saved until you press שמירה.

- **v2.5 — phones**: every screen now works on a phone, for both `admin` and `user`.
  - Admin header: on a small screen the menu becomes a **☰ button** (it shows the name of the current screen); tap it to switch between הזנת קולות, ייבוא, רשימות, פירוט, היסטוריה, מערכות בחירות and מצב.
  - **הזנת קולות** on a phone shows one card per list (name, letters, big vote field with a numeric keyboard, mandates, threshold status, the agreement and danger indicators, and the sensitivity numbers), and a **bar pinned to the bottom** with ביטול / שמירה ופרסום so saving never needs scrolling. The same for **רשימות והסכמים** (name, letters, bloc and agreement per list, arrows to reorder). On tablets and desktops the tables are unchanged.
  - Review tables (import, history, calculation detail) scroll sideways inside their card on narrow screens; the page itself never scrolls sideways.
  - **לוח שידור** already fitted a phone; spacing and type sizes were tightened for small screens.
  - Fixed on the way: a styling precedence issue (utility classes such as widths and paddings were sometimes overridden by the shared button/input styles) and, in the local file backend only, two simultaneous requests could overwrite each other's write.

## Rollback (if ever needed)

Vercel → Deployments → previous deployment → ⋯ → *Promote to Production*. The v1 code reads `election_state`, which the migration leaves untouched.
