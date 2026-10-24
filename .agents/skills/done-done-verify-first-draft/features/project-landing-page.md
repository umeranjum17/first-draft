# The project's landing page and README screenshots

Part of the first-draft verification map. Source: `docs/index.html` (GitHub Pages serves `docs/`), `docs/fonts/`, `docs/media/`, `README.md`.

## How to get to it (user POV)

Open https://umeranjum17.github.io/first-draft/ (from a checkout: open `docs/index.html` in a browser). The README on GitHub shows the same screenshots.

## Driving it

Harness: a browser at 1280x800 and 390x844, light and dark.

1. Open the page. It uses the view's look: the serif headline "Explore designs. Then build.", the install command with a copy button and Get started; then How it works (make, compare, refine, each as a terminal), the three steps with copy buttons, the open-at-every-width facts, the sign-off and agent cards and the footer, which names package.json's version (`first-draft <version>`, stamped by `scripts/landing-version.mjs`). Its own fonts (`docs/fonts`, OFL) load, and any screenshot has a light and a `-dark` variant that follows the theme. Nothing scrolls sideways at 390.
2. Get started moves the page to the three steps.
3. Scripted: `node journeys/landing.mjs <evidence folder>` (or `done-done run landing`) checks fonts, every image in the matching theme, no sideways scroll, the footer version and Get started at 1280 and 390, light and dark, and captures `landing-{1280,390}-{light,dark}.png` (first screen) and `landing-{1280,390}-{light,dark}-full.png` (whole page), plus `steps.json`.
4. The README and landing page show no design screenshots: the old ones showed a small 2026-10-20 MiniMax-M3.1-Flash run and were taken down. A screenshot that returns must be a capture of the real view at 2x on a real run's design that passes the taste rubric, with the README naming the run and its model.
5. Stop what you started.
