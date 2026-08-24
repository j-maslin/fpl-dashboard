# FPL League Dashboard

A public, sign-in-free Fantasy Premier League dashboard for classic league **1112007**, hosted entirely on GitHub Pages.

## How it works

- GitHub Pages serves the HTML/CSS/JavaScript website.
- A scheduled GitHub Actions workflow runs every 15 minutes.
- The workflow requests the public FPL API from GitHub's runner, avoiding browser CORS restrictions.
- It writes the latest league standings to `data/fpl-data.json` in the deployment artifact.
- The workflow then deploys the updated site directly to GitHub Pages.

No API key, FPL login, database, Vercel account, or paid hosting is required.

## Files

- `index.html` – dashboard layout.
- `style.css` – responsive FPL-inspired styling.
- `script.js` – loads the generated JSON and renders the dashboard.
- `scripts/update_fpl.py` – fetches FPL league and gameweek data.
- `.github/workflows/update-fpl-data.yml` – refreshes data and deploys the site every 15 minutes.
- `data/fpl-data.json` – placeholder data; replaced during each deployment.

## GitHub setup

### 1. Create the repository

1. Sign in to GitHub.
2. Select **New repository**.
3. Name it something like `fpl-dashboard`.
4. Set the repository to **Public** if you are using GitHub Free.
5. Create the repository.

### 2. Upload the project

Upload the entire contents of this project to the repository, keeping the directory structure exactly as supplied. In particular, keep:

```text
.github/workflows/update-fpl-data.yml
scripts/update_fpl.py
data/fpl-data.json
index.html
style.css
script.js
.nojekyll
```

You can use **Add file > Upload files** in GitHub if you do not want to use Git locally.

### 3. Enable GitHub Pages

1. Open the repository.
2. Go to **Settings**.
3. Select **Pages** under **Code and automation**.
4. Under **Build and deployment**, set **Source** to **GitHub Actions**.

Do not select `Deploy from a branch` for this project. The supplied workflow handles both data collection and deployment.

### 4. Run the first deployment

1. Open the repository's **Actions** tab.
2. Select **Update and deploy FPL dashboard**.
3. Select **Run workflow**.
4. Leave the branch as `main` and run it.
5. Open the workflow run and confirm all steps are green.

When deployment succeeds, GitHub shows the Pages URL. It will normally look like:

```text
https://YOUR-USERNAME.github.io/fpl-dashboard/
```

### 5. Automatic updates

The supplied schedule is:

```yaml
- cron: "7,22,37,52 * * * *"
```

This runs approximately every 15 minutes at minutes 07, 22, 37 and 52 of each hour. GitHub scheduled workflows can sometimes start a little later than the exact cron minute.

To change the frequency, edit `.github/workflows/update-fpl-data.yml`.

Examples:

```yaml
# Every 30 minutes
- cron: "7,37 * * * *"

# Once per hour
- cron: "7 * * * *"
```

### 6. Change the league later

There are two places containing the current league ID `1112007`:

1. `.github/workflows/update-fpl-data.yml`
2. The FPL link/text in `index.html`

Change both if you want to point the dashboard at another classic league.

## Troubleshooting

### Workflow fails on the FPL data step

Open **Actions > Update and deploy FPL dashboard > failed run > Fetch latest FPL data**. The script prints the FPL HTTP/network error there.

### Pages returns 404

Check **Settings > Pages** and confirm Source is **GitHub Actions**. Then run the workflow manually again.

### Site loads but says data has not been generated

The initial placeholder JSON is being served. Run the workflow manually and confirm its **Fetch latest FPL data** and **Deploy to GitHub Pages** steps both succeed.

### The dashboard is not exactly real-time

The webpage reads the latest JSON produced by the scheduled Action. With the default schedule, data is generally up to 15 minutes behind FPL, plus any GitHub scheduling delay.

### More than 50 managers

The Python fetcher automatically follows FPL's `has_next` pagination flag and combines all standings pages.

## Privacy

The dashboard is public and displays data returned by FPL's public classic-league endpoint, including team and manager names. Do not publish additional private information in the repository.
