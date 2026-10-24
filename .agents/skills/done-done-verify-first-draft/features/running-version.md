# The running version, in the CLI, the view and the landing page

Part of the first-draft verification map. Source: `src/version.mjs` (the one reader of package.json's version), `src/cli.mjs` (`--version`, the help header), `src/view.mjs` (the page's `version`), `src/view/app.js` (`version`), `src/view/view.css` (`.version`), `scripts/landing-version.mjs` (stamps docs/index.html's footer; run by `scripts/build.mjs` and `.github/workflows/pages.yml`).

## How to get to it (user POV)

Run `first-draft-axi --version` (or `-v`) or `first-draft-axi --help`; open the view's picker or Studio; open the landing page's footer.

## Driving it

1. `first-draft-axi --version` and `-v` print the bare version; the first line of `--help` is `first-draft-axi <version>`. An installed package prints package.json's version (`0.2.9`); a source checkout whose HEAD has no `v<version>` (or `<version>`) tag prints `<version>-dev`; a pre-release version (`0.3.0-rc.1`) prints as it is. `test/make.test.mjs` proves all four on a copy of the package (no checkout, untagged checkout, tagged checkout, pre-release).
2. The view names the same version as `first-draft <version>` in quiet muted mono: at the foot of the Studio's panel under the brief box (1280: in view as the Studio opens; 390: at the end of the panel, above the docked brief), under a rule at the foot of the More menu (390), and under the picker's grid. `test/view.test.mjs` checks the panel and picker labels match `--version`; `journeys/studio.mjs` (`done-done run studio`) checks the panel label is in view at 1280 and above the docked brief at 390, checks More, and captures `studio-1280-light.png` (label at the panel foot), `version-390-light.png` (390 scrolled to the end of the panel) and `more-menu-390.png` (More open, light and dark).
3. Scripted, every surface at once: `node journeys/version.mjs <evidence folder>` (or `done-done run version`, a few minutes, no model call) records the CLI output (`cli.txt`) and, at phone 360, 390 and 445 and desktop 1280 and 1440, light and dark, captures the whole frame of the picker at its foot (`version-picker-<width>-<theme>.png`), the Studio with its panel's foot in view (`version-studio-<width>-<theme>.png`; phones scrolled to the end of the panel), the phone More menu (`version-more-<width>-<theme>.png`) and the landing footer (`version-landing-<width>-<theme>.png`). Each frame asserts the label matches `--version` (the landing page: package.json's) and shows whole and uncovered; `version-states.json` and `steps.json` record them.
4. The landing page footer reads `first-draft <version>` with package.json's version (never -dev: it is the released site). `journeys/landing.mjs` (`done-done run landing`) asserts it at 1280 and 390, light and dark; the whole-page captures `landing-*-full.png` show it.
5. Stop what you started.
