# The project's landing page and README screenshots

Part of the first-draft verification map. Source: `docs/index.html` (GitHub Pages serves `docs/`), `docs/fonts/`, `docs/media/`, `README.md`.

## How to get to it (user POV)

Open https://umeranjum17.github.io/first-draft/ (from a checkout: open `docs/index.html` in a browser). The README on GitHub shows the same screenshots.

## Driving it

Harness: a browser at 1280x800 and 390x844, light and dark.

1. Open the page. It uses the view's look: the serif headline "Explore designs. Then build.", the install command with a copy button, Get started, and a screenshot of the Studio on a sheet of canvas; then How it works (make, compare, refine, each with a picture), the three steps with copy buttons, the 390 Studio, the sign-off and agent cards and the footer, which names package.json's version (`first-draft <version>`, stamped by `scripts/landing-version.mjs`). Its own fonts (`docs/fonts`, OFL) load, and every screenshot has a light and a `-dark` variant that follows the theme. Nothing scrolls sideways at 390.
2. Get started moves the page to the three steps.
3. Scripted: `node journeys/landing.mjs <evidence folder>` (or `done-done run landing`) checks fonts, every image in the matching theme, no sideways scroll, the footer version and Get started at 1280 and 390, light and dark, and captures `landing-{1280,390}-{light,dark}.png` (first screen) and `landing-{1280,390}-{light,dark}-full.png` (whole page), plus `steps.json`.
4. README screenshots (`docs/media/{studio,options,studio-390,refine}{,-dark}.webp`) are captures of the real view at 2x on a real run's design (the README names the run). Recapture them from `first-draft-axi view` whenever the view changes, with the README, landing page and agent skill in the same change.
5. Stop what you started.
