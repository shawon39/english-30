# English 30

A 30-day, 100-session tap-first grammar drilling game (tenses, conditionals, modals).
Vanilla HTML + CSS + ES modules. No build step. See [PLAN.md](PLAN.md) for the full design.

## Run locally

ES modules need to be served over HTTP (not `file://`). From the project root:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Add content (your 10 shots)

Drop day files into `content/` as `day-01.json` … `day-30.json` (schema `2.0`, see PLAN.md).
The home map auto-detects which days exist and unlocks them. Append-only — nothing to wire up.

`content/day-01.json` ships as a hand-built sample to validate the schema and feel; overwrite it with your Shot 1.

## Deploy (GitHub Pages)

Push to GitHub → Settings → Pages → deploy from branch (root). `.nojekyll` keeps Pages from touching the files.

## Your progress

Lives in this browser's `localStorage`. Use **Export** on the home screen to download `progress.json` as a backup, and **Import** to restore it or move to another device.
