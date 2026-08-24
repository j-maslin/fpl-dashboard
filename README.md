# Virtuoso FPL Dashboard v2

Public GitHub Pages dashboard for FPL classic league **1112007**.

## Main changes
- Full league table is always visible on the desktop/TV dashboard.
- Active chip usage is shown directly on each manager row as WC/FH/BB/TC, with a key and subtle row highlighting.
- Adds leader, GW king, climber/faller, bad week, most captained, most owned, top differential, captain popularity, manager of the month, performance/position charts, recent GW winners and highest-scoring player.

## Update an existing repository
Replace `index.html`, `style.css`, `script.js`, `scripts/update_fpl.py`, and `.github/workflows/update-fpl-data.yml`. Keep `.nojekyll`. Then run the workflow manually once under **Actions**.

## Fresh setup
1. Create a public GitHub repository.
2. Upload all files to the repository root.
3. If hidden files cannot be uploaded, create `.nojekyll` and `.github/workflows/update-fpl-data.yml` directly in GitHub.
4. Go to **Settings > Pages > Source > GitHub Actions**.
5. Run **Actions > Update and deploy FPL dashboard > Run workflow**.

The dashboard is tuned for a 1920x1080 wallboard but includes responsive layouts for smaller screens.
