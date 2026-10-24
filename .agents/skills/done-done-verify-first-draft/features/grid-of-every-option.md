# Grid of every option (the option picker)

Part of the first-draft verification map. Source: `src/view/app.js` (`grid`), `src/view/view.css` (the option picker).

## How to get to it (user POV)

Open the view url at #/ (the root).

## Driving it

Harness: A shell runs the CLI and curl for the url. A browser tool opens the url and each #/o/<n> route for screenshots.

1. Launch the app as SKILL.md says and wait until it is ready.
2. First-draft-axi view <tmp>/sign-in.html, then open the printed viewing.url in the browser.
3. Check: the bar shows the logo, the design's name and the option count; the design's name is the page's heading in the display face; each option is a card showing it at desktop and phone width on a sheet of canvas (frames load lazily), with its number, name and comment count ("Cannot open" and the reason for an option that cannot), and "Open"; clicking a card opens <url>#/o/<n>, the Studio.
4. Scripted: `node journeys/studio.mjs <evidence folder>` (or `done-done run studio`, with `FD_STUDIO_SOURCE=<folder>` for a real run's design) checks the cards and the click into the Studio and captures `picker-{1280,390}-{light,dark}.png`.
5. Capture: screenshot the resulting page to $DONE_DONE_EVIDENCE_ROOT/grid-of-every-option.png, as SKILL.md's Evidence section says.
6. Stop what you started.

The drive changes no repo file: note findings in the run's report; after the drive, run done-done maintain to see what drifted, then fix the skill.
