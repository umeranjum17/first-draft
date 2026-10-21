# Make render check at 390 and in dark

Part of the first-draft verification map. Source: `src/render-check.mjs`, `src/make.mjs`.

## How to get to it (user POV)

Run `first-draft-axi make "<prompt>" --out <file.html>` on the real model route with Chrome or Chromium installed. The page is rendered headless at 390px in light and in dark inside the `done` check, so a page that scrolls sideways on a phone or has no dark theme is sent back to the model before the command ends.

## Driving it

Harness: a shell runs the CLI with a throwaway FIRST_DRAFT_HOME and the model key in that one command's environment by path (never printed); a browser tool opens the written page.

1. `first-draft-axi init --agent byokit:minimax:key`, then `first-draft-axi make "<a landing page prompt>" --out <tmp>/page.html`.
2. The output JSON has `render_check: "checked"`. With `FIRST_DRAFT_CHROME` set to a path that does not exist it is `skipped`, and stderr holds one warning line.
3. Capture: open `<tmp>/page.html` at 390 and 1280, in light and in dark, and save the 390 screenshots in light and dark plus the scroll width (`document.documentElement.scrollWidth` is 390 at the 390 viewport) to `$DONE_DONE_EVIDENCE_ROOT`; keep the 1280 shots outside it, since they do not show the phone claim.
4. Stop what you started.
5. The light capture shows a light page and the dark capture a dark one; the check fails done when they paint the same.
