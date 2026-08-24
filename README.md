# Virtuoso FPL Dashboard

Static Fantasy Premier League dashboard for GitHub Pages.

## Upload / deploy

1. Upload **all files and folders** in this package to the root of your GitHub repository.
2. Keep `.github/workflows/update-fpl-data.yml`, `.nojekyll`, `assets`, `data`, `scripts`, `index.html`, `style.css`, and `script.js` in their existing paths.
3. In GitHub, open **Actions** and run the FPL update workflow once if required.
4. GitHub Pages should be configured to publish from the repository root/branch used by the existing setup.

## What changed in this version

- Premier League badge added to the top-left header using the supplied artwork.
- More authentic FPL-inspired typography using Barlow Condensed for headings and Inter for body text.
- Background moved closer to the supplied FPL Essentials artwork: turquoise/cyan/blue/purple gradient with neon contour-wave accents.
- Dashboard cards aligned and spaced more consistently.
- Captain popularity, Manager of the Month and climber/faller panels now make fuller use of their available space.
- Added subtle borders, gradients, accent lines and background rings to give cards more visual character without compromising readability.
- Existing data logic, GitHub Actions refresh process, league table, chip indicators and dashboard content remain intact.

## Fonts

The page references Barlow Condensed and Inter from Google Fonts. If Google Fonts cannot load, safe system fallbacks are used automatically.
