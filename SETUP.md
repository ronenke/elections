# elections.keinan.us — setup guide

Same recipe as worldcup.keinan.us: code on GitHub, hosting on Vercel, database on Supabase.
Total time: about 30 minutes. Do the steps in order; each one ends with something you can check.

## What you are setting up

- **GitHub** holds the code. Every push to `main` redeploys the site automatically.
- **Vercel** runs the site at elections.keinan.us and holds the secrets (admin password etc.).
- **Supabase** is the database: the current numbers plus a snapshot of every save (the history screen).

## Step 1 — Put the code on GitHub (5 min)

The code lives in your Google Drive folder:

```
/Users/ronenke/Library/CloudStorage/GoogleDrive-ronenke@gmail.com/My Drive/Stuff/Sharon/Elections/Elections 2026/System
```

1. Unzip `elections.zip` so that `package.json`, `src/` and `supabase/` sit **directly inside** the `System` folder (not inside a nested `elections/` folder — if the unzip created one, move its contents up one level).
2. Go to https://github.com/new. Repository name: `elections`. Private. **Do not** tick "Add a README". Click *Create repository*.
3. In Terminal (the quotes matter — the path contains spaces):
   ```bash
   cd "/Users/ronenke/Library/CloudStorage/GoogleDrive-ronenke@gmail.com/My Drive/Stuff/Sharon/Elections/Elections 2026/System"
   git init -b main
   git add .
   git commit -m "Knesset mandate calculator"
   git remote add origin https://github.com/<your-github-user>/elections.git
   git push -u origin main
   ```
   (If you prefer GitHub Desktop: *File → Add Local Repository* → choose the `System` folder → *Publish repository*, private.)

A note on Google Drive: it works fine as the home of the code, with two habits. Don't run `npm install` in that folder unless you want to work locally — it creates a `node_modules` folder with tens of thousands of small files that Drive will sync slowly (deploying via GitHub/Vercel never needs it). And if Drive shows a sync conflict on a file, the copy on GitHub is the source of truth: `git status` tells you what changed.

✅ Check: refresh the GitHub page — you should see `src/`, `supabase/`, `package.json`.

## Step 2 — Create the Supabase database (7 min)

1. https://supabase.com/dashboard → *New project*. Name: `elections`. Region: **Frankfurt (eu-central-1)** — closest to Israel. Choose a database password (you won't need it again, but save it in your password manager).
2. Wait ~1 minute until the project is ready.
3. Left menu → **SQL Editor** → *New query*. Open the file `supabase/schema.sql` from the code, paste its contents, click **Run**. It should say "Success. No rows returned".
4. Copy two values into your password manager:
   - **Project URL**: `https://<Project ID>.supabase.co` — the Project ID is on *Settings → General* (also shown under *Integrations → Data API*).
   - **service_role** key: *Settings → API Keys → "Legacy API keys" tab → service_role → Reveal* (or create a new *Secret key* on the other tab — it works the same). This key bypasses all security; it lives only in Vercel, never in the code or in a chat.

✅ Check: *Table Editor* shows two empty tables, `election_state` and `snapshots`.

## Step 3 — Deploy on Vercel (8 min)

1. https://vercel.com/new → *Import Git Repository* → pick `elections` (if it isn't listed, click *Adjust GitHub App Permissions* and grant access to the repo).
2. Framework preset: **Next.js** (detected automatically). Leave build settings as they are.
3. Open **Environment Variables** and add these five (Production, Preview and Development all ticked):

   | Name | Value |
   |---|---|
   | `ADMIN_USERNAME` | the login name you want, e.g. `ronen` |
   | `ADMIN_PASSWORD` | a strong password (this is the only lock on the system) |
   | `SESSION_SECRET` | a long random string — in Terminal: `openssl rand -hex 32` and paste the output |
   | `SUPABASE_URL` | the Project URL from step 2 |
   | `SUPABASE_SERVICE_ROLE_KEY` | the service_role key from step 2 |

4. Click **Deploy**. About 1–2 minutes.

✅ Check: open the `*.vercel.app` URL Vercel gives you. You should see the login screen; log in; the vote-entry screen appears with the 2026 lists.

## Step 4 — Point elections.keinan.us at it (5 min + DNS wait)

1. GoDaddy → My Products → keinan.us → **DNS** → *Add new record*: type `CNAME`, name `elections`, data `cname.vercel-dns.com`, TTL 1 hour → Save.
2. Vercel project → **Domains** (direct link: `vercel.com/ronenkes-projects/elections/settings/domains`) → *Add Domain* → `elections.keinan.us` → Connect to environment: Production → Add. A yellow "DNS Change Recommended" is fine (legacy record keeps working); optionally replace the CNAME value with the one Vercel suggests.
3. Wait for Vercel to show a green check (usually minutes, up to an hour). HTTPS is automatic.

✅ Check: https://elections.keinan.us shows the login page.

## Step 5 — Prepare for election night (10 min, can be done any time before)

0. **מערכות בחירות**: check that the election you will use is marked *פעילה* (create one if needed — name, date, CEC URL). Old elections can be kept closed as archives.
1. Log in → **רשימות והסכמים**. Fill in the ballot letters from https://www.gov.il/he/pages/candidates-lists-26, fix names, set blocs (colours are yours to choose), and set surplus agreements as they are published by the CEC (deadline is shortly before election day).
2. Set the CEC results URL once the site exists (expected `https://votes26.bechirot.gov.il/`). Save.
3. Rehearse: **רשימות והסכמים → טעינת חזרה גנרלית (2022)** loads the 2022 election; the board should show Likud 32, Yesh Atid 24 … Labor 4. Then **איפוס לרשימות 2026** to return. Everything you did is in **היסטוריה** and can be restored.

## Election night — how it runs

- Open the **לוח שידור** (the dark screen) on the studio display; it refreshes itself every 10 seconds.
- Whenever the CEC publishes an update: **ייבוא מוועדת הבחירות → משיכת תוצאות עכשיו**. Review the diff (which lists changed, which mandates moved), fix any unmatched row with the dropdown, click **אישור וייבוא**. If the CEC site is slow or blocks the fetch, copy the table from the browser and use **הדבקת טבלה** — same review, same result.
- Or type numbers directly in **הזנת קולות**; mandates update as you type; nothing reaches the board until **שמירה ופרסום**.
- **פירוט החישוב** shows every step (threshold, measure, each Bader-Ofer round, pair splits) for anyone who wants to verify by hand.
- If something goes wrong: **היסטוריה** → pick the last good version → **שחזור**.
- When the results are final: **מערכות בחירות → סגירה (תוצאות סופיות)**. Everything locks and the board shows "תוצאות סופיות". Reopen from the same screen if a correction is needed.
- Updating the code later: see **UPDATE.md**.

## Changing the password later

Vercel → Settings → Environment Variables → edit `ADMIN_PASSWORD` → *Redeploy* (Deployments → ⋯ → Redeploy). Sessions last 14 days; changing `SESSION_SECRET` logs everyone out immediately.

## Running locally (optional)

```bash
cd "/Users/ronenke/Library/CloudStorage/GoogleDrive-ronenke@gmail.com/My Drive/Stuff/Sharon/Elections/Elections 2026/System"
npm install
cp .env.example .env.local   # edit: set ADMIN_*, SESSION_SECRET; leave SUPABASE_* empty to use a local file
npm run dev                  # http://localhost:3000
npm test                     # engine + parser tests (2021 & 2022 official results, fuzz vs exact oracle)
```
