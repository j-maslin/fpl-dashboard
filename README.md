# Virtuoso FPL Dashboard

A public, no-sign-in Fantasy Premier League wallboard for classic league **1112007**, hosted using GitHub Pages and refreshed by GitHub Actions.

## Dashboard features

- Full mini-league table visible on a single 16:9 wallboard without expansion or vertical scrolling.
- League leader, gameweek top scorer, league average and manager count.
- Lead gap, median gameweek score, active chip count and the manager with the most points left on the bench.
- Active chip badges and transfer-hit indicators shown directly in the league table.
- Most captained, most owned and top differential players within this mini-league.
- Captain-popularity donut chart.
- Rolling four-gameweek form leader.
- Biggest climber and faller once rank movement exists; league gaps are shown instead in Gameweek 1.
- Adaptive early-season charts:
  - Current gameweek score bars when only one gameweek exists.
  - Gap-to-leader bars when a position trend cannot yet be plotted.
  - Performance and position trend lines once multiple gameweeks are available.
- Current gameweek podium in Gameweek 1, then recent gameweek winners.
- Highest-scoring FPL player for the active/latest gameweek.
- Data-freshness indicator and a direct link to the official league page.

## Deployment

1. Keep the repository public if using GitHub Pages on GitHub Free.
2. In **Settings → Pages**, set the source to **GitHub Actions**.
3. Open **Actions → Update and deploy FPL dashboard → Run workflow** for the first deployment or an immediate refresh.
4. The scheduled workflow refreshes and republishes the dashboard approximately every 15 minutes.

## Repository structure

```text
.github/workflows/update-fpl-data.yml  GitHub Actions refresh and Pages deployment
assets/premier-league-badge.png        Header artwork
data/fpl-data.json                     Placeholder; regenerated during deployment
scripts/update_fpl.py                  FPL data collector and calculations
index.html                             Dashboard structure
style.css                              Responsive wallboard design
script.js                              Client-side rendering and charts
.nojekyll                              Disables Jekyll processing
```

## League ID

The configured league is set near the top of `scripts/update_fpl.py`:

```python
LEAGUE_ID = 1112007
```

## Display targets

The desktop layout is optimised for 16:9 displays, including 1800×861 browser viewports and 1920×1080 wallboards. Below 1180px wide, the dashboard switches to a scrollable responsive layout.

## Fonts

The page uses Barlow Condensed and Inter from Google Fonts. Safe system fallbacks are used if those fonts cannot be reached.
