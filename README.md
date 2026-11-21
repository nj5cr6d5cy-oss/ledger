# Ledger — personal finance PWA

An offline-first money tracker for iPhone. No backend, no login, no dependencies.
All data is stored on your phone in IndexedDB.

**Stack:** plain HTML + CSS + JavaScript modules. There's no build step, no framework and no `node_modules`.
GitHub Pages serves the folder as is, and nothing needs updating to keep it working.
Node is only used to run the tests.

## 1. Run it locally

```bash
cd ledger            # this folder
python3 -m http.server 8000
```

Open <http://localhost:8000>. (Any static server works, e.g. `npx serve`.) On localhost the service worker fetches fresh files on every load,
so your edits show up straight away.

Run the tests (Node 18+):

```bash
npm test
```

Try it on your phone before deploying: connect the phone to the same Wi-Fi, then open `http://<your-mac's-IP>:8000`.
Find the IP in System Settings → Wi-Fi → Details. Offline mode and "Add to Home Screen" need HTTPS, so use GitHub Pages for those.

## 2. Deploy to GitHub Pages (free)

1. Create a GitHub account at <https://github.com> if you don't have one.
2. Click **+ → New repository**, name it `ledger`, choose **Public** (Pages on private repos needs a paid plan), and click **Create repository**.
3. Upload the files using **either** of these:
   - **Web (no git):** on the new repo page click **uploading an existing file**, drag in *everything inside this folder*
     (`index.html`, `sw.js`, `manifest.webmanifest`, `.nojekyll`, and the `css/`, `js/`, `icons/` folders), then click **Commit changes**.
   - **Terminal:**
     ```bash
     git init && git add . && git commit -m "Ledger PWA"
     git branch -M main
     git remote add origin https://github.com/<your-username>/ledger.git
     git push -u origin main
     ```
4. In the repo go to **Settings → Pages**. Under *Build and deployment*, set **Source: Deploy from a branch**, **Branch: main**, folder **/ (root)**, then **Save**.
5. After about a minute the app is live at `https://<your-username>.github.io/ledger/`.

**Publishing updates:** change the files, **bump `VERSION` in `sw.js`** (e.g. `ledger-v2` → `ledger-v3`), and push or upload again.
Phones pick up the new version the next time the app is opened, possibly after one extra relaunch. Your data is never touched by updates.

## 3. Install on your iPhone

1. Open `https://<your-username>.github.io/ledger/` in **Safari**. It must be Safari; other iOS browsers can't install web apps.
2. Tap the **Share** button (square with an arrow) → **Add to Home Screen** → **Add**.
3. Launch **Ledger** from the home screen. It opens full-screen like a native app and works with no signal.
4. First run: More → *Load sample data* to explore, then More → *Clear all data* when you're ready to use it for real.

> ⚠️ Data lives only on the phone, inside the home-screen app (it's separate from Safari's own storage).
> Back up from **More → Backup & restore** and save the file to iCloud Drive. The app reminds you every 30 days.
> To move to a new phone: back up the JSON → install there → *Restore from backup*.

## Features

| | |
|---|---|
| Quick add (+) | Built-in keypad, last category/method remembered, most-used categories first, Undo |
| Records | Grouped by day, search, filters by month/category/method, swipe left to edit/delete |
| Statement | Income-statement layout, ↑/↓ vs previous month, savings rate, top 5 expenses, any month, PDF via print. Start-of-month banner |
| Yearly | 12-month income vs expenses chart, annual totals, category breakdown |
| Dashboard | Remaining balance, budgets, donut by category, daily or cumulative trend vs last month, goals |
| Budgets | Per category plus overall; warnings at 80% / 100% when you add a record |
| Recurring | Weekly / monthly / yearly; added automatically on their date (catches up if the app wasn't opened) |
| Goals | Target, deadline, monthly amount needed, add/withdraw |
| Backup | JSON (restorable) and CSV export through the iOS share sheet, JSON restore, 30-day reminder |
| App lock | Optional 4-digit PIN, re-locks after 30 s in the background. A privacy screen, not encryption |

## Project layout

```
index.html, sw.js, manifest.webmanifest, icons/, css/app.css
js/app.js          routing & start-up
js/db.js           IndexedDB wrapper (all stores created up front: no migrations)
js/money.js        integer-cents parsing/formatting
js/dates.js        'YYYY-MM-DD' string date helpers
js/stats.js        pure maths: statement, budgets, yearly, goals, reminders (unit-tested)
js/recurring.js    recurring schedule logic (unit-tested)
js/charts.js       tiny SVG charts
js/backup.js, js/lock.js, js/sample.js, js/state.js, js/defaults.js
js/views/*.js      one file per screen
tests/*.test.js    node --test
```

All amounts are stored as **integer cents**. The currency symbol (default `$`) can be changed in More.
